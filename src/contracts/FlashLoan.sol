pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "@studydefi/money-legos/dydx/contracts/DydxFlashloanBase.sol";
import "@studydefi/money-legos/dydx/contracts/ICallee.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@studydefi/money-legos/curvefi/contracts/ICurveFiCurve.sol";

interface IUniswapV2Router02 {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

interface IUniswapV2Router01 {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

contract FlashLoanV2 is ICallee, DydxFlashloanBase {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    uint256 deadline = 60;

    address WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address DAI = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
    address USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
    address TUSD = 0x0000000000085d4780B73119b644AE5ecd22b376;

    // address kyberAddress = 0x818E6FECD516Ecc3849DAf6845e3EC868087B755;
    // KyberNetworkProxy kyberProxy = KyberNetworkProxy(kyberAddress);

    address sushiAddress = 0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F;
    IUniswapV2Router01 sushi = IUniswapV2Router01(sushiAddress);

    address uniAddress = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;
    IUniswapV2Router02 uni = IUniswapV2Router02(uniAddress);

    address curveFi_curve_yDai_yUsdc_yUsdt_ytUsd =
        0x45F783CCE6B7FF23B2ab2D70e416cdb7D6055f51;
    ICurveFiCurve curve = ICurveFiCurve(curveFi_curve_yDai_yUsdc_yUsdt_ytUsd);

    address payable owner;

    address[] public tokenPath;
    address[] public exchangePath;

    mapping(address => int128) public indexes;
    int128 constant daiIndex = 0; //for curvedefi swap
    int128 constant usdcIndex = 1; //for curvefi swap
    int128 constant usdtIndex = 2; //for curvefi swap
    int128 constant tusdIndex = 3; //for curvefi swap

    event Data(uint256 borrowed, uint256 out, uint256 profit);

    constructor() public {
        owner = msg.sender;
        indexes[DAI] = daiIndex;
        indexes[USDC] = usdcIndex;
        indexes[USDT] = usdtIndex;
        indexes[TUSD] = tusdIndex;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "caller is not the owner!");
        _;
    }

    struct MyCustomData {
        address token;
        uint256 repayAmount;
    }

    function _tokenToTokenUni(
        address srcToken,
        uint256 amount,
        address[] memory swapPath
    ) internal returns (uint256[] memory) {
        require(
            IERC20(swapPath[0]).balanceOf(msg.sender) >= amount,
            "Not enough tokens in the contract"
        );

        IERC20(swapPath[0]).safeApprove(uniAddress, 0);
        IERC20(swapPath[0]).safeApprove(uniAddress, amount);

        uint256[] memory amounts = uni.swapExactTokensForTokens(
            amount,
            1,
            swapPath,
            address(this),
            block.timestamp + deadline
        );
        return amounts;
    }

    function _tokenToTokenSushi(
        address srcToken,
        uint256 amount,
        address[] memory swapPath
    ) internal returns (uint256[] memory) {
        require(
            IERC20(swapPath[0]).balanceOf(msg.sender) >= amount,
            "Not enough tokens in the contract"
        );

        IERC20(swapPath[0]).safeApprove(sushiAddress, 0);
        IERC20(swapPath[0]).safeApprove(sushiAddress, amount);

        uint256[] memory amounts = sushi.swapExactTokensForTokens(
            amount,
            1,
            swapPath,
            address(this),
            block.timestamp + deadline
        );
        return amounts;
    }


    function _tokenToTokenCurve(
        address srcToken,
        uint256 amount,
        int128 indexIn,
        int128 indexOut
    ) internal returns (uint256) {
        require(
            IERC20(srcToken).balanceOf(msg.sender) >= amount,
            "Not enough tokens in the contract"
        );

        IERC20(srcToken).safeApprove(curveFi_curve_yDai_yUsdc_yUsdt_ytUsd, 0);
        IERC20(srcToken).safeApprove(
            curveFi_curve_yDai_yUsdc_yUsdt_ytUsd,
            amount
        );

        curve.exchange_underlying(indexIn, indexOut, amount, 1);
    }

    // This is the function that will be called postLoan
    // i.e. Encode the logic to handle your flashloaned funds here
    function callFunction(
        address sender,
        Account.Info memory account,
        bytes memory data
    ) public {
        MyCustomData memory mcd = abi.decode(data, (MyCustomData));
        uint256 balOfLoanedToken = IERC20(mcd.token).balanceOf(address(this));

        // Note that you can ignore the line below
        // if your dydx account (this contract in this case)
        // has deposited at least ~2 Wei of assets into the account
        // to balance out the collaterization ratio
        require(
            balOfLoanedToken >= mcd.repayAmount,
            "Not enough funds to repay dydx loan!"
        );
        // TODO: Encode your logic here
        // E.g. arbitrage, liquidate accounts, etc

        //Dejamos en el smart contract lo depositado para las fees (2(Wei) DAI)
        uint256 srcQty = balOfLoanedToken.sub(2);
        uint256 amountOfTokens = srcQty;
        address firstToken;

        for (uint256 j = 0; j < exchangePath.length; j++) {
            if (j == 0) {
                firstToken = mcd.token;
            } else {
                firstToken = tokenPath[j - 1];
            }
            if (exchangePath[j] == uniAddress) {
                if (
                    j < exchangePath.length - 1 &&
                    exchangePath[j + 1] == uniAddress
                ) {
                    address[] memory path = new address[](3);
                    path[0] = firstToken;
                    path[1] = tokenPath[j];
                    path[2] = tokenPath[j + 1];
                    uint256[] memory amountsOut = _tokenToTokenUni(
                        firstToken,
                        amountOfTokens,
                        path
                    );
                    amountOfTokens = amountsOut[amountsOut.length - 1];
                    j++;
                } else {
                    address[] memory path = new address[](2);
                    path[0] = firstToken;
                    path[1] = tokenPath[j];
                    uint256[] memory amountsOut = _tokenToTokenUni(
                        firstToken,
                        amountOfTokens,
                        path
                    );
                    amountOfTokens = amountsOut[amountsOut.length - 1];
                }
            } else if (exchangePath[j] == sushiAddress) {
                if (
                    j < exchangePath.length - 1 &&
                    exchangePath[j + 1] == sushiAddress
                ) {
                    address[] memory path = new address[](3);
                    path[0] = firstToken;
                    path[1] = tokenPath[j];
                    path[2] = tokenPath[j + 1];
                    uint256[] memory amountsOut = _tokenToTokenSushi(
                        firstToken,
                        amountOfTokens,
                        path
                    );
                    amountOfTokens = amountsOut[amountsOut.length - 1];
                    j++;
                } else {
                    address[] memory path = new address[](2);
                    path[0] = firstToken;
                    path[1] = tokenPath[j];
                    uint256[] memory amountsOut = _tokenToTokenSushi(
                        firstToken,
                        amountOfTokens,
                        path
                    );
                    amountOfTokens = amountsOut[amountsOut.length - 1];
                }
            } else {
                int128 firstIndex = indexes[firstToken];
                int128 secondIndex = indexes[tokenPath[j]];
                if (
                    j < exchangePath.length - 1 &&
                    exchangePath[j + 1] == curveFi_curve_yDai_yUsdc_yUsdt_ytUsd
                ) {
                    int128 thirdIndex = indexes[tokenPath[j + 1]];
                    _tokenToTokenCurve(
                        firstToken,
                        amountOfTokens,
                        firstIndex,
                        secondIndex
                    );
                    uint256 firstAmountOut = IERC20(tokenPath[j]).balanceOf(
                        address(this)
                    );
                    amountOfTokens = _tokenToTokenCurve(
                        tokenPath[j],
                        firstAmountOut,
                        secondIndex,
                        thirdIndex
                    );
                    j++;
                } else {
                    _tokenToTokenCurve(
                        firstToken,
                        amountOfTokens,
                        firstIndex,
                        secondIndex
                    );
                    uint256 amountOut = IERC20(tokenPath[j]).balanceOf(
                        address(this)
                    );
                    amountOfTokens = amountOut;
                }
            }
        }

        uint256 finalAmount = IERC20(mcd.token).balanceOf(address(this)).sub(2);
        require(finalAmount > srcQty, "No profits");
        uint256 profits = finalAmount.sub(srcQty).sub(2);

        emit Data(srcQty, finalAmount, profits);
        IERC20(mcd.token).safeTransfer(owner, profits);
    }

    function initiateFlashLoan(
        address _solo,
        address _token,
        uint256 _amount,
        address[] calldata _exchangePath,
        address[] calldata _tokenPath
    ) external payable onlyOwner {
        ISoloMargin solo = ISoloMargin(_solo);

        // Get marketId from token address
        uint256 marketId = _getMarketIdFromTokenAddress(_solo, _token);

        // Calculate repay amount (_amount + (2 wei))
        // Approve transfer from
        uint256 repayAmount = _getRepaymentAmountInternal(_amount);
        IERC20(_token).approve(_solo, repayAmount);

        //Initialize paths
        tokenPath = _tokenPath;
        exchangePath = _exchangePath;

        // 1. Withdraw $
        // 2. Call callFunction(...)
        // 3. Deposit back $
        Actions.ActionArgs[] memory operations = new Actions.ActionArgs[](3);

        operations[0] = _getWithdrawAction(marketId, _amount);
        operations[1] = _getCallAction(
            // Encode MyCustomData for callFunction
            abi.encode(MyCustomData({token: _token, repayAmount: repayAmount}))
        );
        operations[2] = _getDepositAction(marketId, repayAmount);

        Account.Info[] memory accountInfos = new Account.Info[](1);
        accountInfos[0] = _getAccountInfo();

        solo.operate(accountInfos, operations);
    }
}
