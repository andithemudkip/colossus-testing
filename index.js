const fs = require ('fs');
class DEX {
    constructor (name, pairs) {
        this.name = name;
        this.pairs = pairs;
        this.stats = {
            'SOL/USDC': {
                volume: {
                    SOL: 0,
                    USDC: 0
                },
                profit: {
                    SOL: 0,
                    USDC: 0
                },
                trades: 0
            }
        };
    }

    calcPrice (pair, token) {
        let reserves = this.pairs[pair].reserves;
        let otherToken = this.pairs[pair].composition.find(t => t !== token);
        return (reserves[otherToken] / reserves[token]);
    }

    calcK (pair) {
        let reserves = this.pairs [pair].reserves;
        return reserves [this.pairs [pair].composition [0]] * reserves [this.pairs [pair].composition [1]];
    }

    getAmountOut (amountIn, reserveIn, reserveOut) {
        const amountInWithFee = amountIn * 0.997;
        const numerator = amountInWithFee * reserveOut;
        const denominator = reserveIn + amountInWithFee;
        return numerator / denominator;
    }

    swap (pair, tokenA, tokenB, amount) {
        let out = this.getAmountOut (amount, this.pairs [pair].reserves [tokenA], this.pairs [pair].reserves [tokenB]);
        this.pairs [pair].reserves [tokenA] += amount;
        this.pairs [pair].reserves [tokenB] -= out;
        const slippage = 0.0025 * out;
        out -= slippage;
        this.stats [pair].volume [tokenA] += amount;
        this.stats [pair].volume [tokenB] += out;
        return {
            reserves: this.pairs [pair].reserves,
            tokenBReturns: out
        };
    }
    
    simulateSwap (pair, tokenA, tokenB, amount) {
        let out = this.getAmountOut (amount, this.pairs [pair].reserves [tokenA], this.pairs [pair].reserves [tokenB]);
        let reserves = {
            [tokenA]: this.pairs [pair].reserves [tokenA] + amount,
            [tokenB]: this.pairs [pair].reserves [tokenB] - out
        };
        let priceOfTokenB = reserves [tokenA] / reserves [tokenB];
        const slippage = 0.0025 * out;
        out -= slippage;
        return {
            reserves,
            tokenBReturns: out,
            priceOfTokenB
        };
    }
}

class Ignifi extends DEX {
    constructor (name, pairs, funds) {
        super (name, pairs);
        this.funds = funds;
    }
    doArbitrage (pair, dex) {
        const tokenA = this.pairs[pair].composition [0];
        const tokenB = this.pairs[pair].composition [1];
        const tokenAPrice = this.calcPrice (pair, tokenA);
        const tokenBPrice = this.calcPrice (pair, tokenB);
        const tokenAPriceDex = dex.calcPrice (pair, tokenA);
        const tokenBPriceDex = dex.calcPrice (pair, tokenB);
        if (tokenAPrice > tokenAPriceDex && tokenBPrice < tokenBPriceDex) {
            const reserves = this.pairs [pair].reserves;
            const reservesNeeded = reserves [tokenB] * tokenBPriceDex;
            const idealAmountTokenA = reservesNeeded - reserves [tokenA];
            const amountTokenA = Math.min (this.funds [tokenA], idealAmountTokenA, reserves [tokenA] * 0.01, dex.pairs [pair].reserves [tokenA] * 0.01);
            // simulate the swap on this dex
            const ignisim = this.simulateSwap (pair, tokenA, tokenB, amountTokenA);
            // simulate the swap on the other dex
            const dexsim = dex.simulateSwap (pair, tokenB, tokenA, ignisim.tokenBReturns);
            // calculate the profit
            const profitsim = dexsim.tokenBReturns - amountTokenA;
            const percentage = profitsim / amountTokenA * 100;

            if (percentage < 0.5) return false;

            const { tokenBReturns } = this.swap (pair, tokenA, tokenB, amountTokenA);
            const returns = dex.swap (pair, tokenB, tokenA, tokenBReturns);
            const profit = returns.tokenBReturns - amountTokenA;

            // add 5% of the profit to the funds
            const toFunds = profit * 0.05;
            this.funds [tokenA] += toFunds;
            this.stats [pair].profit [tokenA] += profit - toFunds;
            this.stats [pair].trades++;
            return true;
        } else if (tokenAPrice < tokenAPriceDex && tokenBPrice > tokenBPriceDex) {
            const reserves = this.pairs [pair].reserves;
            const reservesNeeded = reserves [tokenA] * tokenAPriceDex;
            const idealAmountTokenB = reservesNeeded - reserves [tokenB];
            const amountTokenB = Math.min (this.funds [tokenB], idealAmountTokenB, reserves [tokenB] * 0.01, dex.pairs [pair].reserves [tokenB] * 0.01);
            
            // simulate the swap on this dex
            const ignisim = this.simulateSwap (pair, tokenB, tokenA, amountTokenB);
            // simulate the swap on the other dex
            const dexsim = dex.simulateSwap (pair, tokenA, tokenB, ignisim.tokenBReturns);
            // calculate the profit
            const profitsim = dexsim.tokenBReturns - amountTokenB;
            const percentage = profitsim / amountTokenB * 100;

            if (percentage < 0.5) return false;

            const { tokenBReturns } = this.swap (pair, tokenB, tokenA, amountTokenB);
            const returns = dex.swap (pair, tokenA, tokenB, tokenBReturns);
            const profit = returns.tokenBReturns - amountTokenB;
            const toFunds = profit * 0.05;
            this.funds [tokenB] += toFunds;
            this.stats [pair].profit [tokenB] += profit - toFunds;
            this.stats [pair].trades++;
            return true;
        } else {
            return false;
        }
    }
}

let uniswap = new DEX ('uniswap', {
    'SOL/USDC': {
        composition: ['SOL', 'USDC'],
        reserves: {
            SOL: 1000,
            USDC: 250000
        }
    }
});

let ignifi = new Ignifi ('igni.fi', {
    'SOL/USDC': {
        composition: ['SOL', 'USDC'],
        reserves: {
            SOL: 1000,
            USDC: 250000
        }
    }   
},
    {
        SOL: 10,
        USDC: 2500
    }
);

const initialK = ignifi.calcK ('SOL/USDC');
const initialUniswapK = uniswap.calcK ('SOL/USDC');
const reservesLog = [];
const ignifiReservesLog = [];
const doRandomTradeOnIgnifi = true;
for (let i = 0; i < 200; i++) {
    const tokenA = uniswap.pairs['SOL/USDC'].composition [Math.floor (Math.random () * 2)];
    const tokenB = uniswap.pairs['SOL/USDC'].composition.find (t => t !== tokenA);
    const multiplier = Math.random () > 0.8 ? 0.035 : 0.025;
    const amountTokenA = Number ((Math.random () * uniswap.pairs['SOL/USDC'].reserves[tokenA] * multiplier).toFixed (2));
    uniswap.swap('SOL/USDC', tokenA, tokenB, amountTokenA);
    
    // do random trade on ignifi
    if (doRandomTradeOnIgnifi) {
        const multiplierIgni = Math.random () > 0.9 ? 0.02 : 0.01;
        const tokenAIndex = Math.floor (Math.random () * 2);
        const tokenBIndex = Number (!tokenAIndex);
        const tokenA = ignifi.pairs['SOL/USDC'].composition [tokenAIndex];
        const tokenB = ignifi.pairs['SOL/USDC'].composition [tokenBIndex];
        const amountTokenAIgni = Number ((Math.random () * ignifi.pairs['SOL/USDC'].reserves[tokenA] * multiplierIgni).toFixed (2));
        ignifi.swap ('SOL/USDC', tokenA, tokenB, amountTokenAIgni);
    }

    let iters = 0, maxIters = 10;
    while (ignifi.doArbitrage ('SOL/USDC', uniswap) && iters < maxIters) { iters++ };

    const uniswapReserves = {
        SOL: uniswap.pairs ['SOL/USDC'].reserves ['SOL'],
        USDC: uniswap.pairs ['SOL/USDC'].reserves ['USDC']
    }
    const ignifiReserves = {
        SOL: ignifi.pairs ['SOL/USDC'].reserves ['SOL'],
        USDC: ignifi.pairs ['SOL/USDC'].reserves ['USDC']
    }

    reservesLog.push (uniswapReserves);
    ignifiReservesLog.push (ignifiReserves);
}
// write the logs to json files
fs.writeFileSync ('./uniswapReserves.json', JSON.stringify (reservesLog));
fs.writeFileSync ('./ignifiReserves.json', JSON.stringify (ignifiReservesLog));

// calculate profit
const profit = ignifi.stats ['SOL/USDC'].profit;
const volume = ignifi.stats ['SOL/USDC'].volume;
const uniswapVolume = uniswap.stats ['SOL/USDC'].volume;
const percentage = {
    SOL: profit.SOL / volume.SOL * 100,
    USDC: profit.USDC / volume.USDC * 100
};
const finalK = ignifi.calcK ('SOL/USDC');
const finalUniK = uniswap.calcK ('SOL/USDC');

const reservesIncludingProfit = {
    SOL: ignifi.pairs ['SOL/USDC'].reserves ['SOL'] + ignifi.stats ['SOL/USDC'].profit ['SOL'],
    USDC: ignifi.pairs ['SOL/USDC'].reserves ['USDC'] + ignifi.stats ['SOL/USDC'].profit ['USDC']
};

const IgnifiUSDCValue = ignifi.pairs ['SOL/USDC'].reserves.USDC + ignifi.stats ['SOL/USDC'].profit ['USDC'] + (ignifi.pairs ['SOL/USDC'].reserves.SOL + ignifi.stats ['SOL/USDC'].profit ['SOL']) * uniswap.calcPrice ('SOL/USDC', 'SOL');
const UniswapUSDCValue = uniswap.pairs ['SOL/USDC'].reserves.USDC + uniswap.pairs ['SOL/USDC'].reserves.SOL * uniswap.calcPrice ('SOL/USDC', 'SOL');
const percentageGrowth = (IgnifiUSDCValue - UniswapUSDCValue) / UniswapUSDCValue * 100;

const KIncludingProfit = reservesIncludingProfit.SOL * reservesIncludingProfit.USDC;
const KGrowthPercent = (finalK - initialK) / initialK * 100;
const KGrowthPercentIncludingProfit = (KIncludingProfit - initialK) / initialK * 100;
const KGrowthPercentUni = (finalUniK - initialUniswapK) / initialUniswapK * 100;

console.log ('\n - Price -');
console.log ('<other dex>: price of SOL', uniswap.calcPrice ('SOL/USDC', 'SOL'));
console.log ('<igni.fi>: price of SOL', ignifi.calcPrice ('SOL/USDC', 'SOL'));

console.log ('\n - Stats -');
console.log (`<other dex> volume: ${uniswapVolume.SOL.toFixed (8)} SOL`);
console.log (`<other dex> volume: ${uniswapVolume.USDC.toFixed (8)} USDC`);
console.log (`<igni.fi> volume: ${volume.SOL.toFixed (8)} SOL`);
console.log (`<igni.fi> volume: ${volume.USDC.toFixed (8)} USDC`);
console.log (`<igni.fi> arb profit: ${profit.SOL.toFixed (8)} SOL (${percentage.SOL.toFixed (2)}% of volume)`);
console.log (`<igni.fi> arb profit: ${profit.USDC.toFixed (8)} USDC (${percentage.USDC.toFixed (2)}% of volume)`);
console.log (`<igni.fi> trades: ${ignifi.stats ['SOL/USDC'].trades}`);
console.log (`<igni.fi> funds: ${ignifi.funds.SOL.toFixed (8)} SOL`);
console.log (`<igni.fi> funds: ${ignifi.funds.USDC.toFixed (8)} USDC`);

console.log ('\n - Reserves -');
console.log (`<other dex> (LP): ${uniswap.pairs['SOL/USDC'].reserves.SOL.toFixed (8)} SOL`);
console.log (`<other dex> (LP): ${uniswap.pairs['SOL/USDC'].reserves.USDC.toFixed (8)} USDC`);

console.log (`<igni.fi> (LP): ${ignifi.pairs['SOL/USDC'].reserves.SOL.toFixed (8)} SOL`);
console.log (`<igni.fi> (LP): ${ignifi.pairs['SOL/USDC'].reserves.USDC.toFixed (8)} USDC`);

console.log (`<igni.fi> (LP + ARB): ${(ignifi.pairs ['SOL/USDC'].reserves ['SOL'] + ignifi.stats ['SOL/USDC'].profit ['SOL']).toFixed (8)} SOL`);
console.log (`<igni.fi> (LP + ARB): ${(ignifi.pairs ['SOL/USDC'].reserves ['USDC'] + ignifi.stats ['SOL/USDC'].profit ['USDC']).toFixed (8)} USDC`);

console.log ('\n- USDC Value -');
console.log (`<other dex> (LP): ${UniswapUSDCValue.toFixed (8)} USDC`);
console.log (`<igni.fi> (LP + ARB): ${IgnifiUSDCValue.toFixed (8)} USDC`);
console.log (`USDC delta: ${(IgnifiUSDCValue - UniswapUSDCValue).toFixed (8)} USDC (${percentageGrowth.toFixed (2)}%)`);

console.log ('\n- K -');
console.log (`<other dex> initial K: ${Math.round (initialUniswapK)}`);
console.log (`<other dex> (LP): ${finalUniK.toFixed (8)} (+${KGrowthPercentUni.toFixed (2)}%)`);
console.log (`<igni.fi> initial K: ${Math.round (initialK)}`);
console.log (`<igni.fi> (LP): ${Math.round (finalK)} (${KGrowthPercent.toFixed (2)}% growth)`);
console.log (`<igni.fi> (LP + ARB): ${KIncludingProfit.toFixed (8)} (+${KGrowthPercentIncludingProfit.toFixed (2)}%)`);
console.log (`<igni.fi> K growth: ${(KGrowthPercentIncludingProfit / KGrowthPercentUni).toFixed (2)}x of <other dex>`);