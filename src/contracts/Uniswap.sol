pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@studydefi/money-legos/uniswap/contracts/IUniswapFactory.sol";
import "@studydefi/money-legos/uniswap/contracts/IUniswapExchange.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract UniSwap {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IUniswapFactory factory =
        IUniswapFactory(0xc0a47dFe034B400B47bDaD5FecDa2621de6c4d95);

    address owner;

    address etherAddress = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    constructor() public {
        owner = msg.sender;
    }

    modifier _ownerOnly() {
        require(msg.sender == owner);
        _;
    }

    function() external payable {}

    function tokenToToken(
        address srcToken,
        uint256 amount,
        address destToken,
        uint256 deadline
    ) external returns (uint256) {
        address exchangeAddress = factory.getExchange(srcToken);

        address exchangeDestAddress = factory.getExchange(destToken);

        require(
            exchangeAddress != address(0),
            "Invalid source exchange address"
        );

        require(
            exchangeDestAddress != address(0),
            "Invalid dest exchange address"
        );

        require(
            IERC20(srcToken).balanceOf(msg.sender) >= amount,
            "Not enough tokens in the contract"
        );

        IUniswapExchange exchange = IUniswapExchange(exchangeAddress);
        IUniswapExchange exchangeOut = IUniswapExchange(exchangeDestAddress);

        IERC20(srcToken).safeTransferFrom(msg.sender, address(this), amount);

        IERC20(srcToken).safeApprove(address(exchange), 0);

        IERC20(srcToken).safeApprove(address(exchange), amount);

        uint256 minConversionRateEther = exchange.getTokenToEthInputPrice(
            amount
        );

        uint256 minConversionRate = exchangeOut.getEthToTokenInputPrice(
            minConversionRateEther
        );

        uint256 tokenBalance = exchange.tokenToTokenSwapInput(
            amount,
            minConversionRate,
            minConversionRateEther,
            deadline,
            destToken
        );

        IERC20(destToken).safeTransfer(msg.sender, tokenBalance);

        return tokenBalance;
    }

    function tokenToExchange(
        address srcToken,
        uint256 amount,
        address destToken,
        uint256 deadline
    ) external _ownerOnly returns (uint256) {
        address exchangeAddress = factory.getExchange(srcToken);

        address exchangeDestAddress = factory.getExchange(destToken);

        require(
            exchangeAddress != address(0),
            "Invalid source exchange address"
        );

        require(
            exchangeDestAddress != address(0),
            "Invalid dest exchange address"
        );

        require(
            IERC20(srcToken).balanceOf(msg.sender) >= amount,
            "Not enough tokens in the contract"
        );

        IUniswapExchange exchange = IUniswapExchange(exchangeAddress);
        IUniswapExchange exchangeOut = IUniswapExchange(exchangeDestAddress);

        IERC20(srcToken).safeTransferFrom(msg.sender, address(this), amount);

        IERC20(srcToken).safeApprove(address(exchange), 0);

        IERC20(srcToken).safeApprove(address(exchange), amount);

        uint256 minConversionRateEther = exchange.getTokenToEthInputPrice(
            amount
        );

        uint256 minConversionRate = exchangeOut.getEthToTokenInputPrice(
            minConversionRateEther
        );

        uint256 tokenBalance = exchange.tokenToExchangeSwapInput(
            amount,
            minConversionRate,
            minConversionRateEther,
            deadline,
            exchangeDestAddress
        );

        IERC20(destToken).safeTransfer(msg.sender, tokenBalance);
        return tokenBalance;
    }

    function ethToToken(address destToken, uint256 deadline)
        external
        payable
        _ownerOnly
        returns (uint256)
    {
        address exchangeAddress = factory.getExchange(destToken);

        require(exchangeAddress != address(0), "Invalid exchange address");

        require(
            address(this).balance >= msg.value,
            "Not enough ether in the contract"
        );

        IUniswapExchange exchange = IUniswapExchange(exchangeAddress);

        uint256 minConversionRate = exchange.getEthToTokenInputPrice(msg.value);

        uint256 tokenBalance = exchange.ethToTokenSwapInput.value(msg.value)(
            minConversionRate.mul(97).div(100),
            deadline
        );

        IERC20(destToken).safeTransfer(msg.sender, tokenBalance);

        return tokenBalance;
    }

    function tokenToEth(
        address srcToken,
        uint256 amount,
        uint256 deadline
    ) external _ownerOnly returns (uint256) {
        address exchangeAddress = factory.getExchange(srcToken);

        require(exchangeAddress != address(0), "Invalid exchange address");

        IUniswapExchange exchange = IUniswapExchange(exchangeAddress);

        IERC20(srcToken).safeTransferFrom(msg.sender, address(this), amount);

        IERC20(srcToken).safeApprove(exchangeAddress, 0);

        IERC20(srcToken).safeApprove(exchangeAddress, amount);

        require(
            IERC20(srcToken).balanceOf(address(this)) >= amount,
            "Not enough source tokens in the contract"
        );

        uint256 minConversionRate = exchange.getTokenToEthInputPrice(amount);

        uint256 ethBalance = exchange.tokenToEthSwapInput(
            amount,
            minConversionRate.mul(97).div(100),
            deadline
        );

        msg.sender.transfer(ethBalance);

        return ethBalance;
    }
}
