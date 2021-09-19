const { legos } = require('@studydefi/money-legos');
const { expect } = require('chai');

var chai = require('chai');

var should = chai.should();
var assert = chai.assert;

const Kyber = artifacts.require('KyberSwap');

contract('Kyber', ([acc]) => {
  let dai, weth;

  beforeEach(async () => {
    //dai contract
    dai = new web3.eth.Contract(legos.erc20.dai.abi, legos.erc20.dai.address);

    weth = new web3.eth.Contract(legos.erc20.weth.abi, legos.erc20.weth.address);

    contract = await Kyber.new();
  });

  describe('Performing swap ...', () => {
    it('Swapping 1 ETH for DAI is succesful', async () => {
      let ethBalanceBefore, daiBalanceBefore, ethBalanceAfter, daiBalanceAfter;

      ethBalanceBefore = await web3.eth.getBalance(acc);

      daiBalanceBefore = await dai.methods.balanceOf(acc).call();

      console.log('ETH balance before: ' + ethBalanceBefore);
      console.log('DAI balance before: ' + daiBalanceBefore);

      await contract.ethToToken(
        legos.erc20.eth.address,
        web3.utils.toWei('1', 'ether'),
        legos.erc20.dai.address,
        { from: acc, value: web3.utils.toWei('1', 'ether') }
      );

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

    it('Swapping 1000 DAI for WETH is succesful', async () => {
      let wethBalanceBefore, daiBalanceBefore, wethBalanceAfter, daiBalanceAfter;

      await contract.ethToToken(
        legos.erc20.eth.address,
        web3.utils.toWei('1', 'ether'),
        legos.erc20.dai.address,
        { from: acc, value: web3.utils.toWei('2', 'ether') }
      );

      var daiAmount = '1000';

      daiBalanceBefore = await dai.methods.balanceOf(acc).call();

      wethBalanceBefore = await weth.methods.balanceOf(acc).call();

      console.log('WETH balance before: ' + wethBalanceBefore);
      console.log('DAI balance before: ' + daiBalanceBefore);

      await dai.methods
        .approve(contract.address, web3.utils.toWei(daiAmount, 'ether'))
        .send({ from: acc });

      await contract.tokenToToken(
        legos.erc20.dai.address,
        web3.utils.toWei(daiAmount, 'ether'),
        legos.erc20.weth.address,
        { from: acc }
      );

      daiBalanceAfter = await dai.methods.balanceOf(acc).call();

      wethBalanceAfter = await weth.methods.balanceOf(acc).call();

      console.log('WETH balance after: ' + wethBalanceAfter);
      console.log('DAI balance after: ' + daiBalanceAfter);

      assert.isAbove(
        parseInt(wethBalanceAfter),
        parseInt(wethBalanceBefore),
        'There is more WETH now than before'
      );

      assert.isAbove(
        parseInt(daiBalanceBefore),
        parseInt(daiBalanceAfter),
        'There is less DAI now than before'
      );
    });

    it('Swapping 1000 DAI for ETH is succesful', async () => {
      let ethBalanceBefore, daiBalanceBefore, ethBalanceAfter, daiBalanceAfter;

      await contract.ethToToken(
        legos.erc20.eth.address,
        web3.utils.toWei('1', 'ether'),
        legos.erc20.dai.address,
        { from: acc, value: web3.utils.toWei('1', 'ether') }
      );

      var daiAmount = '1000';

      daiBalanceBefore = await dai.methods.balanceOf(acc).call();

      ethBalanceBefore = await web3.eth.getBalance(acc);

      console.log('ETH balance before: ' + ethBalanceBefore);
      console.log('DAI balance before: ' + daiBalanceBefore);

      await dai.methods
        .approve(contract.address, web3.utils.toWei(daiAmount, 'ether'))
        .send({ from: acc });

      await contract.tokenToEth(
        legos.erc20.dai.address,
        web3.utils.toWei(daiAmount, 'ether'),
        legos.erc20.eth.address,
        { from: acc }
      );

      daiBalanceAfter = await dai.methods.balanceOf(acc).call();

      ethBalanceAfter = await web3.eth.getBalance(acc);

      console.log('ETH balance after: ' + ethBalanceAfter);
      console.log('DAI balance after: ' + daiBalanceAfter);

      assert.isAbove(
        parseInt(ethBalanceAfter),
        parseInt(ethBalanceBefore),
        'There is more ETH now than before'
      );

      assert.isAbove(
        parseInt(daiBalanceBefore),
        parseInt(daiBalanceAfter),
        'There is less DAI now than before'
      );
    });
  });
});
