const { legos } = require('@studydefi/money-legos');
const { expect } = require('chai');

var chai = require('chai');

var should = chai.should();
var assert = chai.assert;

const UniSwap = artifacts.require('UniSwap');

contract('UniSwap', ([acc, provider]) => {
  let dai, usdc;
  var deadline = Date.now() + 20;
  var decimals = 1 * 10 ** 18;

  //Date cuenta que aunque crees un nuevo contrato, es la misma dirección, los balance no cambian de un test a otro.
  beforeEach(async () => {
    //dai contract
    dai = new web3.eth.Contract(legos.erc20.dai.abi, legos.erc20.dai.address);

    usdc = new web3.eth.Contract(legos.erc20.usdc.abi, legos.erc20.usdc.address);

    contract = await UniSwap.new();
  });

  describe('Performing swaps Token -> Token ...', () => {
    it('Swapping 1 ETH for DAI is succesful', async () => {
      let ethBalanceBefore, daiBalanceBefore, ethBalanceAfter, daiBalanceAfter;

      ethBalanceBefore = await web3.eth.getBalance(acc);

      daiBalanceBefore = await dai.methods.balanceOf(acc).call();

      console.log('ETH balance before: ' + ethBalanceBefore);
      console.log('DAI balance before: ' + daiBalanceBefore);

      await contract.ethToToken(legos.erc20.dai.address, deadline, {
        from: acc,
        value: web3.utils.toWei('1', 'ether'),
      });

      ethBalanceAfter = await web3.eth.getBalance(acc);

      daiBalanceAfter = await dai.methods.balanceOf(acc).call();

      console.log('ETH balance after: ' + ethBalanceAfter);
      console.log('DAI balance after: ' + daiBalanceAfter);

      assert.isAbove(
        parseInt(daiBalanceAfter),
        parseInt(daiBalanceBefore),
        'There is more DAI now than before'
      );

      assert.isAbove(
        parseInt(ethBalanceBefore),
        parseInt(ethBalanceAfter),
        'There is less ETH now than before'
      );
    });

    console.log(' ');

    it('Swapping 1000 DAI for ETH is succesful', async () => {
      let ethBalanceBefore, daiBalanceBefore, ethBalanceAfter, daiBalanceAfter;

      //Importante tener en cuenta el precio de conversión DAI/ETHER
      await contract.ethToToken(legos.erc20.dai.address, deadline, {
        from: acc,
        value: web3.utils.toWei('1', 'ether'),
      });

      daiBalanceBefore = await dai.methods.balanceOf(acc).call();

      ethBalanceBefore = await web3.eth.getBalance(acc);

      console.log('ETH balance before: ' + ethBalanceBefore);
      console.log('DAI balance before: ' + daiBalanceBefore);

      var daiAmount = '1000';

      await dai.methods
        .approve(contract.address, web3.utils.toWei(daiAmount, 'ether'))
        .send({ from: acc });

      await contract.tokenToEth(
        legos.erc20.dai.address,
        web3.utils.toWei(daiAmount, 'ether'),
        deadline,
        { from: acc }
      );

      daiBalanceAfter = await dai.methods.balanceOf(acc).call();

      ethBalanceAfter = await web3.eth.getBalance(acc);

      console.log('ETH balance after: ' + ethBalanceAfter);
      console.log('DAI balance after: ' + daiBalanceAfter);

      assert.isAbove(
        parseInt(daiBalanceBefore),
        parseInt(daiBalanceAfter),
        'There is less DAI now than before'
      );

      assert.isAbove(
        parseInt(ethBalanceAfter),
        parseInt(ethBalanceBefore),
        'There is more ETH now than before'
      );
    });

    console.log(' ');

    it('Swapping 1000 DAI for USDC is succesful', async () => {
      let usdcBalanceBefore, daiBalanceBefore, usdcBalanceAfter, daiBalanceAfter;

      //Importante tener en cuenta el precio de conversión DAI/ETHER
      await contract.ethToToken(legos.erc20.dai.address, deadline, {
        from: acc,
        value: web3.utils.toWei('1', 'ether'),
      });

      daiBalanceBefore = await dai.methods.balanceOf(acc).call();
      usdcBalanceBefore = await usdc.methods.balanceOf(acc).call();

      console.log('USDC balance before: ' + usdcBalanceBefore);
      console.log('DAI balance before: ' + daiBalanceBefore);

      var daiAmount = '1000';

      await dai.methods
        .approve(contract.address, web3.utils.toWei(daiAmount, 'ether'))
        .send({ from: acc });

      await contract.tokenToToken(
        legos.erc20.dai.address,
        web3.utils.toWei(daiAmount, 'ether'),
        legos.erc20.usdc.address,
        deadline,
        { from: acc }
      );

      daiBalanceAfter = await dai.methods.balanceOf(acc).call();

      usdcBalanceAfter = await usdc.methods.balanceOf(acc).call();

      console.log('USDC balance after: ' + usdcBalanceAfter);
      console.log('DAI balance after: ' + daiBalanceAfter);

      assert.isAbove(
        parseInt(daiBalanceBefore),
        parseInt(daiBalanceAfter),
        'There is less DAI now than before'
      );

      assert.isAbove(
        parseInt(usdcBalanceAfter),
        parseInt(usdcBalanceBefore),
        'There is more USDC now than before'
      );
    });

    console.log(' ');
  });

  describe('Performing swaps Token -> Exchange ...', () => {
    it('Swapping 1000 DAI for USDC is succesful', async () => {
      let usdcBalanceBefore, daiBalanceBefore, usdcBalanceAfter, daiBalanceAfter;
      let factory, usdcExchangeAddress, usdcExchange;

      //Importante tener en cuenta el precio de conversión DAI/ETHER
      await contract.ethToToken(legos.erc20.dai.address, deadline, {
        from: acc,
        value: web3.utils.toWei('1', 'ether'),
      });

      //Get exchange
      factory = new web3.eth.Contract(legos.uniswap.factory.abi, legos.uniswap.factory.address);
      usdcExchangeAddress = await factory.methods.getExchange(legos.erc20.usdc.address).call();
      usdcExchange = new web3.eth.Contract(legos.uniswap.exchange.abi, usdcExchangeAddress);

      daiBalanceBefore = await dai.methods.balanceOf(acc).call();
      usdcBalanceBefore = await usdc.methods.balanceOf(acc).call();

      var usdcExchangeBalance = await usdc.methods.balanceOf(usdcExchangeAddress).call();
      var ethExchangeBalance = await web3.eth.getBalance(usdcExchangeAddress);

      console.log('USDC/ETH exchange balance: ' + usdcExchangeBalance + ' / ' + ethExchangeBalance);
      console.log('USDC balance before: ' + usdcBalanceBefore);
      console.log('DAI balance before: ' + daiBalanceBefore);

      var daiAmount = '1000';

      await dai.methods
        .approve(contract.address, web3.utils.toWei(daiAmount, 'ether'))
        .send({ from: acc });

      await contract.tokenToExchange(
        legos.erc20.dai.address,
        web3.utils.toWei(daiAmount, 'ether'),
        legos.erc20.usdc.address,
        deadline,
        { from: acc }
      );

      daiBalanceAfter = await dai.methods.balanceOf(acc).call();

      usdcBalanceAfter = await usdc.methods.balanceOf(acc).call();

      console.log('USDC balance after: ' + usdcBalanceAfter);
      console.log('DAI balance after: ' + daiBalanceAfter);

      assert.isAbove(
        parseInt(daiBalanceBefore),
        parseInt(daiBalanceAfter),
        'There is less DAI now than before'
      );

      assert.isAbove(
        parseInt(usdcBalanceAfter),
        parseInt(usdcBalanceBefore),
        'There is more USDC now than before'
      );
    });
  });
});
