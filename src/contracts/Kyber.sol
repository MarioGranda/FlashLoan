pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@studydefi/money-legos/kyber/contracts/KyberNetworkProxy.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract KyberSwap {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    KyberNetworkProxy kyberProxy =
        KyberNetworkProxy(0x818E6FECD516Ecc3849DAf6845e3EC868087B755);

    address owner;

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
        address destToken
    ) external returns (uint256) {
        require(
            IERC20(srcToken).balanceOf(msg.sender) >= amount,
            "Not enough tokens in the contract"
        );

        IERC20(srcToken).transferFrom(msg.sender, address(this), amount);

        IERC20(srcToken).safeApprove(address(kyberProxy), 0);

        IERC20(srcToken).safeApprove(address(kyberProxy), amount);

        (uint256 rate, uint256 minConversionRate) = kyberProxy.getExpectedRate(
            IERC20(srcToken),
            IERC20(destToken),
            amount
        );

        uint256 slippageRate = 3;
        require(
            (rate.sub(minConversionRate)).div(rate) < slippageRate,
            "Slippage rate too high!"
        );


        uint256 tokenBalance = kyberProxy.swapTokenToToken(
            IERC20(srcToken),
            amount,
            IERC20(destToken),
            minConversionRate
        );

        IERC20(destToken).safeTransfer(msg.sender, tokenBalance);

        return tokenBalance;
    }

    function ethToToken(
        address srcToken,
        uint256 amount,
        address destToken
    ) external payable _ownerOnly returns (uint256) {
        require(
            address(this).balance >= amount,
            "Not enough ether in the contract"
        );

        (uint256 rate, uint256 minConversionRate) = kyberProxy.getExpectedRate(
            IERC20(srcToken),
            IERC20(destToken),
            amount
        );

        uint256 slippageRate = 3;
        require(
            (rate.sub(minConversionRate)).div(rate) < slippageRate,
            "Slippage rate too high!"
        );

        uint256 tokenBalance = kyberProxy.swapEtherToToken.value(amount)(
            IERC20(destToken),
            2200000000000000000000
        );

        IERC20(destToken).safeTransfer(msg.sender, tokenBalance);

        return tokenBalance;
    }

    function tokenToEth(
        address srcToken,
        uint256 amount,
        address destToken
    ) external _ownerOnly returns (uint256) {
        require(
            IERC20(srcToken).balanceOf(msg.sender) >= amount,
            "Not enough ether in the contract"
        );

        IERC20(srcToken).transferFrom(msg.sender, address(this), amount);

        IERC20(srcToken).safeApprove(address(kyberProxy), 0);

        IERC20(srcToken).safeApprove(address(kyberProxy), amount);

        (uint256 rate, uint256 minConversionRate) = kyberProxy.getExpectedRate(
            IERC20(srcToken),
            IERC20(destToken),
            amount
        );

        uint256 slippageRate = 3;
        require(
            (rate.sub(minConversionRate)).div(rate) < slippageRate,
            "Slippage rate too high!"
        );

        uint256 ethBalance = kyberProxy.swapTokenToEther(
            IERC20(srcToken),
            amount,
            minConversionRate
        );

        msg.sender.transfer(ethBalance);

        return ethBalance;
    }
}
