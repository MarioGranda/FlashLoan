const { legos } = require('@studydefi/money-legos');
const { expect } = require('chai');
const moment = require('moment');
const truffleAssert = require('truffle-assertions');
const BigNumber = require('bignumber.js');
const fs = require('fs');

const router02 = JSON.parse(
	fs.readFileSync(__dirname + '/../src/otherAbis/IUniswapV2Router02.json', 'utf8')
);
const curveAbi = JSON.parse(fs.readFileSync(__dirname + '/../src/abis/ICurveFiCurve.json', 'utf8'));

const chai = require('chai');
// .use(require('chai-as-promised'))
// .should()

var assert = chai.assert;
var should = chai.should();

const FlashLoanV2 = artifacts.require('FlashLoanV2');

contract('FlashLoanV2', ([acc]) => {
	const sushiAddress = '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F';
	const uniAddress = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
	const curveAddress = '0x45F783CCE6B7FF23B2ab2D70e416cdb7D6055f51';

	let dai, uniswapContract, curvefiContract, sushiswapContract, daiBalance, daiBalanceContract;

	const SETTINGS = {
		gasLimit: 6000000,
		gasPrice: web3.utils.toWei('50', 'Gwei'),
		from: acc,
		value: web3.utils.toWei('1', 'ether'),
	};

	const CURVE_TOKENS = {
		DAI: legos.erc20.dai.address,
		USDC: legos.erc20.usdc.address,
		USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
		//TUSD: '0x0000000000085d4780B73119b644AE5ecd22b376',
	};

	beforeEach(async () => {
		//contracts declaration for swapping ETH=>DAI
		dai = new web3.eth.Contract(legos.erc20.dai.abi, legos.erc20.dai.address);

		uniswapContract = new web3.eth.Contract(router02, uniAddress);

		sushiswapContract = new web3.eth.Contract(router02, sushiAddress);

		curvefiContract = new web3.eth.Contract(curveAbi.abi, curveAddress);

		contract = await FlashLoanV2.new();

		daiBalance = await dai.methods.balanceOf(acc).call();

		//swap 1 ETH=>DAI
		if (daiBalance <= 2) {
			const now = moment().unix();
			const deadline = now + 60;
			await uniswapContract.methods
				.swapExactETHForTokens(
					0,
					[legos.erc20.weth.address, legos.erc20.dai.address],
					acc,
					deadline
				)
				.send(SETTINGS);
		}

		daiBalanceContract = await dai.methods.balanceOf(contract.address).call();

		//send 1 DAI to contract (for flash loan fee)
		if (daiBalanceContract <= 2) {
			await dai.methods.transfer(contract.address, 2).send({ from: acc });
		}
	});

	describe('Performing Flash Loan SUSHI & UNI...', () => {
		it('Borrowing 1000 DAI and arbitraging with WETH...', async () => {
			const amount = '1000000';

			let uniToSushi, exchangePath;
			let daiBalanceBefore, daiBalanceAfter, daiBalanceBeforeWallet, daiBalanceAfterWallet;

			//CHECK UNISWAP PRICES
			var tokensAmountSushi = await sushiswapContract.methods
				.getAmountsOut(web3.utils.toWei(amount, 'ether'), [
					legos.erc20.dai.address,
					legos.erc20.weth.address,
				])
				.call();
			//CHECK UNISWAP PRICES
			var tokensAmountUni = await uniswapContract.methods
				.getAmountsOut(web3.utils.toWei(amount, 'ether'), [
					legos.erc20.dai.address,
					legos.erc20.weth.address,
				])
				.call();

			if (
				tokensAmountSushi[tokensAmountSushi.length - 1] >
				tokensAmountUni[tokensAmountUni.length - 1]
			) {
				uniToSushi = false;
				exchangePath = [sushiAddress, uniAddress];
			} else {
				uniToSushi = true;
				exchangePath = [uniAddress, sushiAddress];
			}

			let sushiPrice = new BigNumber(tokensAmountSushi[tokensAmountSushi.length - 1]);
			let uniPrice = new BigNumber(tokensAmountUni[tokensAmountUni.length - 1]);

			console.log('Sushi price: ' + sushiPrice.shiftedBy(-18));
			console.log('Uniswap price: ' + uniPrice.shiftedBy(-18));

			if (uniToSushi == true) {
				var realAmountSushi = await sushiswapContract.methods
					.getAmountsOut(web3.utils.toWei(uniPrice.shiftedBy(-18), 'ether'), [
						legos.erc20.weth.address,
						legos.erc20.dai.address,
					])
					.call();
				let expectedReturnSushi = new BigNumber(realAmountSushi[1]);
				console.log('UNI --> SUSHI');
				console.log('Real amount Sushi: ' + expectedReturnSushi.shiftedBy(-18));
			} else {
				var realAmountUni = await uniswapContract.methods
					.getAmountsOut(
						web3.utils.toWei(sushiPrice.shiftedBy(-18).toString(), 'ether'),
						[legos.erc20.weth.address, legos.erc20.dai.address]
					)

					.call();
				let expectedReturnUni = new BigNumber(realAmountUni[1]);
				console.log('SUSHI --> UNI');
				console.log('Real amount Uni: ' + expectedReturnUni.shiftedBy(-18));
			}

			daiBalanceBefore = await dai.methods.balanceOf(contract.address).call();
			daiBalanceBeforeWallet = await dai.methods.balanceOf(acc).call();
			daiBalanceBeforeWallet = new BigNumber(daiBalanceBeforeWallet);

			console.log('DAI balance before (Contract): ' + daiBalanceBefore);
			console.log('DAI balance before (Wallet): ' + daiBalanceBeforeWallet.shiftedBy(-18));

			var result = await contract.initiateFlashLoan(
				legos.dydx.soloMargin.address,
				legos.erc20.dai.address,
				web3.utils.toWei(amount, 'Ether'),
				exchangePath,
				[legos.erc20.weth.address, legos.erc20.dai.address],
				{ from: acc }
			);

			truffleAssert.eventEmitted(
				result,
				'Data',
				(ev) => {
					console.log(
						ev.out.toString() +
							' - ' +
							ev.borrowed.toString() +
							' = ' +
							ev.profit.toString()
					);
					return ev.out.gt(ev.borrowed);
				},
				'Contract should return the transaction data.'
			);

			function timeout(ms) {
				return new Promise((resolve, reject) => {
					setTimeout(async () => {
						daiBalanceAfter = await dai.methods.balanceOf(contract.address).call();
						daiBalanceAfterWallet = await dai.methods.balanceOf(acc).call();
						daiBalanceAfterWallet = new BigNumber(daiBalanceAfterWallet);
						resolve('¡Éxito!');
					}, ms);
				});
			}

			await timeout(5000);

			console.log('DAI balance after (Contract): ' + daiBalanceAfter);
			console.log('DAI balance after (Wallet): ' + daiBalanceAfterWallet.shiftedBy(-18));
		});
	});

	// describe('Performing Flash Loan CURVE & UNI...', () => {
	// 	it('Borrowing 100000 DAI and arbitraging with stablecoin...', async () => {
	// 		const amount = '100000';

	// 		let uniToCurve, exchangePath;
	// 		let daiBalanceBefore, daiBalanceAfter, daiBalanceBeforeWallet, daiBalanceAfterWallet;

	// 		let returnsArray = [];
	// 		let exchangeArray = [];

	// 		//CHECK CURVE & UNI PRICES
	// 		for (let i = 1; i < 3; i++) {
	// 			var tokensAmountCurve = await curvefiContract.methods
	// 				.get_dy(0, i, web3.utils.toWei(amount, 'ether'))
	// 				.call();
	// 			var tokensAmountUni = await uniswapContract.methods
	// 				.getAmountsOut(web3.utils.toWei(amount, 'ether'), [
	// 					legos.erc20.dai.address,
	// 					Object.values(CURVE_TOKENS)[i],
	// 				])
	// 				.call();

	// 			let uniPrice = new BigNumber(tokensAmountUni[tokensAmountUni.length - 1]);
	// 			let curvePrice = new BigNumber(tokensAmountCurve);

	// 			if (i < 3) {
	// 				if (uniPrice.shiftedBy(-6) > curvePrice.shiftedBy(-6)) {
	// 					var realAmountCurve = await curvefiContract.methods
	// 						.get_dy(i, 0, uniPrice.toString())
	// 						.call();
	// 					let expectedReturnsCurve = new BigNumber(realAmountCurve);
	// 					returnsArray.push(expectedReturnsCurve.shiftedBy(-18));
	// 					exchangeArray.push('UNI -> CURVE');
	// 				} else {
	// 					var realAmountUni = await uniswapContract.methods
	// 						.getAmountsOut(tokensAmountCurve, [
	// 							Object.values(CURVE_TOKENS)[i],
	// 							legos.erc20.dai.address,
	// 						])
	// 						.call();
	// 					let expectedReturnsUni = new BigNumber(realAmountUni);
	// 					returnsArray.push(expectedReturnsUni.shiftedBy(-18));
	// 					exchangeArray.push('CURVE -> UNI');
	// 				}
	// 			} else {
	// 				if (uniPrice.shiftedBy(-18) > curvePrice.shiftedBy(-18)) {
	// 					var realAmountCurve = await curvefiContract.methods
	// 						.get_dy(i, 0, uniPrice.toString())
	// 						.call();
	// 					let expectedReturnsCurve = new BigNumber(realAmountCurve);
	// 					returnsArray.push(expectedReturnsCurve.shiftedBy(-18));
	// 					exchangeArray.push('UNI -> CURVE');
	// 				} else {
	// 					var realAmountUni = await uniswapContract.methods
	// 						.getAmountsOut(tokensAmountCurve, [
	// 							Object.values(CURVE_TOKENS)[i],
	// 							legos.erc20.dai.address,
	// 						])
	// 						.call();
	// 					let expectedReturnsUni = new BigNumber(realAmountUni);
	// 					returnsArray.push(expectedReturnsUni.shiftedBy(-18));
	// 					exchangeArray.push('CURVE -> UNI');
	// 				}
	// 			}
	// 		}

	// 		var max = returnsArray.reduce(function (a, b) {
	// 			return Math.max(a, b);
	// 		}, 0);

	// 		const maxIndex = () => {
	// 			for (var i = 0, len = returnsArray.length; i < len; i++) {
	// 				if (returnsArray[i] == max) {
	// 					return i;
	// 				}
	// 			}
	// 		};

	// 		let token;
	// 		let index = maxIndex();

	// 		if (index === 0) {
	// 			token = 'USDC';
	// 		} else if (index === 1) {
	// 			token = 'USDT';
	// 		} else {
	// 			token = 'TUSD';
	// 		}

	// 		if (exchangeArray[maxIndex] === 'CURVE -> UNI') {
	// 			uniToCurve = false;
	// 			exchangePath = [curveAddress, uniAddress];
	// 		} else {
	// 			uniToCurve = true;
	// 			exchangePath = [uniAddress, curveAddress];
	// 		}

	// 		console.log('Returns Array: ' + returnsArray);
	// 		console.log('Exchange Path: ' + exchangeArray);
	// 		if (uniToCurve == true) {
	// 			console.log('UNI --> CURVE: ' + token);
	// 		} else {
	// 			console.log('CURVE --> UNI: ' + token);
	// 		}

	// 		daiBalanceBefore = await dai.methods.balanceOf(contract.address).call();
	// 		daiBalanceBeforeWallet = await dai.methods.balanceOf(acc).call();
	// 		daiBalanceBeforeWallet = new BigNumber(daiBalanceBeforeWallet);

	// 		console.log('DAI balance before (Contract): ' + daiBalanceBefore);
	// 		console.log('DAI balance before (Wallet): ' + daiBalanceBeforeWallet.shiftedBy(-18));

	// 		var result = await contract.initiateFlashLoan(
	// 			legos.dydx.soloMargin.address,
	// 			legos.erc20.dai.address,
	// 			web3.utils.toWei(amount, 'Ether'),
	// 			exchangePath,
	// 			[CURVE_TOKENS[token], legos.erc20.dai.address],
	// 			{ gasLimit: SETTINGS.gasLimit, gasPrice: SETTINGS.gasPrice, from: SETTINGS.from }
	// 		);

	// 		truffleAssert.eventEmitted(
	// 			result,
	// 			'Data',
	// 			(ev) => {
	// 				console.log(
	// 					ev.out.toString() +
	// 						' - ' +
	// 						ev.borrowed.toString() +
	// 						' = ' +
	// 						ev.profit.toString()
	// 				);
	// 				return ev.out.gt(ev.borrowed);
	// 			},
	// 			'Contract should return the transaction data.'
	// 		);

	// 		function timeout(ms) {
	// 			return new Promise((resolve, reject) => {
	// 				setTimeout(async () => {
	// 					daiBalanceAfter = await dai.methods.balanceOf(contract.address).call();
	// 					daiBalanceAfterWallet = await dai.methods.balanceOf(acc).call();
	// 					resolve('¡Éxito!');
	// 				}, ms);
	// 			});
	// 		}

	// 		await timeout(5000);

	// 		console.log('DAI balance after (Contract): ' + daiBalanceAfter);
	// 		console.log('DAI balance after (Wallet): ' + daiBalanceAfterWallet);
	// 	});
	// });

	// describe('Performing Flash Loan CURVE & SUSHI...', () => {
	// 	it('Borrowing 100000 DAI and arbitraging with stablecoin...', async () => {
	// 		const amount = '1000';

	// 		let sushiToCurve, exchangePath;
	// 		let daiBalanceBefore, daiBalanceAfter, daiBalanceBeforeWallet, daiBalanceAfterWallet;

	// 		let returnsArray = [];
	// 		let exchangeArray = [];

	// 		//CHECK CURVE & UNI PRICES
	// 		for (let i = 1; i < 3; i++) {
	// 			var tokensAmountCurve = await curvefiContract.methods
	// 				.get_dy(0, i, web3.utils.toWei(amount, 'ether'))
	// 				.call();
	// 			var tokensAmountSushi = await sushiswapContract.methods
	// 				.getAmountsOut(web3.utils.toWei(amount, 'ether'), [
	// 					legos.erc20.dai.address,
	// 					Object.values(CURVE_TOKENS)[i],
	// 				])
	// 				.call();

	// 			let sushiPrice = new BigNumber(tokensAmountSushi[tokensAmountSushi.length - 1]);
	// 			let curvePrice = new BigNumber(tokensAmountCurve);
	// 			console.log(sushiPrice);
	// 			console.log(curvePrice);

	// 			if (i < 3) {
	// 				if (sushiPrice.shiftedBy(-6) > curvePrice.shiftedBy(-6)) {
	// 					var realAmountCurve = await curvefiContract.methods
	// 						.get_dy(i, 0, sushiPrice.toString())
	// 						.call();
	// 					let expectedReturnsCurve = new BigNumber(realAmountCurve);
	// 					returnsArray.push(expectedReturnsCurve.shiftedBy(-18));
	// 					exchangeArray.push('SUSHI -> CURVE');
	// 				} else {
	// 					var realAmountSushi = await sushiswapContract.methods
	// 						.getAmountsOut(tokensAmountCurve, [
	// 							Object.values(CURVE_TOKENS)[i],
	// 							legos.erc20.dai.address,
	// 						])
	// 						.call();
	// 					let expectedReturnsSushi = new BigNumber(realAmountSushi);
	// 					returnsArray.push(expectedReturnsSushi.shiftedBy(-18));
	// 					exchangeArray.push('CURVE -> SUSHI');
	// 				}
	// 			} else {
	// 				if (sushiPrice.shiftedBy(-18) > curvePrice.shiftedBy(-18)) {
	// 					var realAmountCurve = await curvefiContract.methods
	// 						.get_dy(i, 0, sushiPrice.toString())
	// 						.call();
	// 					let expectedReturnsCurve = new BigNumber(realAmountCurve);
	// 					returnsArray.push(expectedReturnsCurve.shiftedBy(-18));
	// 					exchangeArray.push('SUSHI -> CURVE');
	// 				} else {
	// 					var realAmountSushi = await sushiswapContract.methods
	// 						.getAmountsOut(tokensAmountCurve, [
	// 							Object.values(CURVE_TOKENS)[i],
	// 							legos.erc20.dai.address,
	// 						])
	// 						.call();
	// 					let expectedReturnsSushi = new BigNumber(realAmountSushi);
	// 					returnsArray.push(expectedReturnsSushi.shiftedBy(-18));
	// 					exchangeArray.push('CURVE -> SUSHI');
	// 				}
	// 			}
	// 		}

	// 		var max = returnsArray.reduce(function (a, b) {
	// 			return Math.max(a, b);
	// 		}, 0);

	// 		const maxIndex = () => {
	// 			for (var i = 0, len = returnsArray.length; i < len; i++) {
	// 				if (returnsArray[i] == max) {
	// 					return i;
	// 				}
	// 			}
	// 		};

	// 		let token;
	// 		let index = maxIndex();

	// 		if (index === 0) {
	// 			token = 'USDC';
	// 		} else if (index === 1) {
	// 			token = 'USDT';
	// 		} else {
	// 			token = 'TUSD';
	// 		}

	// 		if (exchangeArray[maxIndex] === 'CURVE -> SUSHI') {
	// 			sushiToCurve = false;
	// 			exchangePath = [curveAddress, sushiAddress];
	// 		} else {
	// 			sushiToCurve = true;
	// 			exchangePath = [sushiAddress, curveAddress];
	// 		}

	// 		console.log('Returns Array: ' + returnsArray);
	// 		console.log('Exhange Path: ' + exchangeArray);
	// 		if (sushiToCurve == true) {
	// 			console.log('SUSHI --> CURVE: ' + token);
	// 		} else {
	// 			console.log('CURVE --> SUSHI: ' + token);
	// 		}

	// 		daiBalanceBefore = await dai.methods.balanceOf(contract.address).call();
	// 		daiBalanceBeforeWallet = await dai.methods.balanceOf(acc).call();
	// 		daiBalanceBeforeWallet = new BigNumber(daiBalanceBeforeWallet);

	// 		console.log('DAI balance before (Contract): ' + daiBalanceBefore);
	// 		console.log('DAI balance before (Wallet): ' + daiBalanceBeforeWallet.shiftedBy(-18));

	// 		var result = await contract.initiateFlashLoan(
	// 			legos.dydx.soloMargin.address,
	// 			legos.erc20.dai.address,
	// 			web3.utils.toWei(amount, 'Ether'),
	// 			exchangePath,
	// 			[CURVE_TOKENS[token], legos.erc20.dai.address],
	// 			{ gasLimit: SETTINGS.gasLimit, gasPrice: SETTINGS.gasPrice, from: SETTINGS.from }
	// 		);

	// 		truffleAssert.eventEmitted(
	// 			result,
	// 			'Data',
	// 			(ev) => {
	// 				console.log(
	// 					ev.out.toString() +
	// 						' - ' +
	// 						ev.borrowed.toString() +
	// 						' = ' +
	// 						ev.profit.toString()
	// 				);
	// 				return ev.out.gt(ev.borrowed);
	// 			},
	// 			'Contract should return the transaction data.'
	// 		);

	// 		function timeout(ms) {
	// 			return new Promise((resolve, reject) => {
	// 				setTimeout(async () => {
	// 					daiBalanceAfter = await dai.methods.balanceOf(contract.address).call();
	// 					daiBalanceAfterWallet = await dai.methods.balanceOf(acc).call();
	// 					resolve('¡Éxito!');
	// 				}, ms);
	// 			});
	// 		}

	// 		await timeout(5000);

	// 		console.log('DAI balance after (Contract): ' + daiBalanceAfter);
	// 		console.log('DAI balance after (Wallet): ' + daiBalanceAfterWallet);
	// 	});
	// });
});
