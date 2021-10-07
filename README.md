## 📃 Instructions to run
0. **Install dependencies in project directory(working with node v14.16.1.)**
</br>```npm i```
1. **Install ganache-cli (globaly)**
</br>```npm i -g ganache-cli```
2. **In 1st terminal window fork mainnet with ganache-cli**
</br>```ganache-cli -p 8545 -f <https://YOUR_ETH_PROVIDER>```
3. **In 2nd terminal window run tests**
</br>```trufle test```
</br>!Note: To reset data, restart ganache-cli after each test.
</br>

## Smart Contracts
There are three smart contracs:
1. **kyber.sol:**
It allows you to swap tokens through KyberSwap. (:exclamation:Update: KyberSwap is no longer available).
2. **uniswap.sol:**
It allows you to swap tokens through Uniswap V1.
3. **flashloan.sol:**
Implementation of DyDx flash loan. You just need to specify the exchanges and tokens involved in your transactions when calling the function **initiateFlashLoan**. In order for the transaction to be successful, you will need to search for opportunities, whether your preferred strategy is arbitrage, yield farming or other.
**Only three exchanges are supported**: Uniswap, Sushiswap and DAI+USDC+USDT+TUSD CurveFinance's pool. 

:warning:**Important Note: flashloan.sol tests work fine but they will fail if no profits are made.**:warning:

