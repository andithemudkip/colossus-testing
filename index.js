// let uniswapTest = {
//     pairs: {
//         'SOL/USDC': {
//             composition: ['SOL', 'USDC'],
//             reserves: {
//                 SOL: 100,
//                 USDC: 250000
//             }
//         }
//     },
//     calcPrice (pair, token) {
//         let reserves = this.pairs[pair].reserves;
//         let otherToken = this.pairs[pair].composition.find(t => t !== token);
//         return (reserves[otherToken] / reserves[token]).toFixed (8);
//     },
//     calcK (pair) {
//         let reserves = this.pairs [pair].reserves;
//         return reserves [this.pairs [pair].composition [0]] * reserves [this.pairs [pair].composition [1]];
//     },
//     swap (pair, tokenA, tokenB, amount) {
//         let reserves = this.pairs[pair].reserves;
//         let newAReserves = reserves[tokenA] + amount;
//         let newBReserves = this.calcK (pair) / newAReserves;
//         let newReserves = {
//             [tokenA]: newAReserves,
//             [tokenB]: newBReserves
//         };
//         const tokenBReturns = reserves[tokenB] - newBReserves;
//         this.pairs[pair].reserves = newReserves;
//         return {
//             reserves: newReserves,
//             tokenBReturns
//         }
//     },
//     simulateSwap (pair, tokenA, tokenB, amount) {
//         let reserves = this.pairs[pair].reserves;
//         let newAReserves = reserves[tokenA] + amount;
//         let newBReserves = this.calcK (pair) / newAReserves;
//         let newReserves = {
//             [tokenA]: newAReserves,
//             [tokenB]: newBReserves
//         };
//         let tokenBReturns = reserves[tokenB] - newBReserves;
//         let priceOfTokenB = newReserves[tokenA] / newReserves[tokenB];
//         return {
//             reserves: newReserves,
//             tokenBReturns,
//             priceOfTokenB
//         };
//     }
// }
const fs = require ('fs');

class DEX {
    constructor (name, pairs) {
        this.name = name;
        this.pairs = pairs;
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

    swap (pair, tokenA, tokenB, amount) {
        let reserves = this.pairs[pair].reserves;
        const fee = 0.003 * amount;
        let newAReserves = reserves[tokenA] + amount - fee;
        let newBReserves = this.calcK (pair) / newAReserves;

        let newReserves = {
            [tokenA]: newAReserves + fee,
            [tokenB]: newBReserves
        };
        let tokenBReturns = reserves[tokenB] - newBReserves;
        const slippage = 0.0025 * tokenBReturns;
        tokenBReturns -= slippage;
        this.pairs[pair].reserves = newReserves;
        return {
            reserves: newReserves,
            tokenBReturns
        }
    }

    simulateSwap (pair, tokenA, tokenB, amount) {
        let reserves = this.pairs[pair].reserves;
        let newAReserves = reserves[tokenA] + amount;
        let newBReserves = this.calcK (pair) / newAReserves;
        let newReserves = {
            [tokenA]: newAReserves,
            [tokenB]: newBReserves
        };
        let tokenBReturns = reserves[tokenB] - newBReserves;
        const slippage = 0.0025 * tokenBReturns;
        tokenBReturns -= slippage;
        let priceOfTokenB = newReserves[tokenA] / newReserves[tokenB];
        return {
            reserves: newReserves,
            tokenBReturns,
            priceOfTokenB
        };
    }
}

class Ignifi extends DEX {
    constructor (name, pairs, funds) {
        super (name, pairs);
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
            // console.log ('swap', tokenA, 'for', tokenB, 'on', this.name);
            // console.log ('swap', tokenB, 'for', tokenA, 'on', dex.name);

            const reserves = this.pairs [pair].reserves;
            // reserves [tokenA] / reserves [tokenB] = tokenBPriceDex
            // reserves [tokenA] = reserves [tokenB] * tokenBPriceDex
            // reserves [tokenA] need to be this much in order for the price of tokenA to match the price of tokenA on dex
            const reservesNeeded = reserves [tokenB] * tokenBPriceDex;
            const idealAmountTokenA = reservesNeeded - reserves [tokenA];
            // const amountTokenA = Math.min (idealAmountTokenA, reserves [tokenA] * 0.01, dex.pairs [pair].reserves [tokenA] * 0.01);
            const amountTokenA = Math.min (this.funds [tokenA], idealAmountTokenA, reserves [tokenA] * 0.01, dex.pairs [pair].reserves [tokenA] * 0.01);
            
            // console.log (`using ${amountTokenA} ${tokenA} to buy ${tokenB} on ${this.name}`);
            // simulate the swap on this dex
            const ignisim = this.simulateSwap (pair, tokenA, tokenB, amountTokenA);
            // simulate the swap on the other dex
            const dexsim = dex.simulateSwap (pair, tokenB, tokenA, ignisim.tokenBReturns);
            // calculate the profit
            const profitsim = dexsim.tokenBReturns - amountTokenA;
            const percentage = profitsim / amountTokenA * 100;

            if (percentage < 0.7) return false;

            const { tokenBReturns } = this.swap (pair, tokenA, tokenB, amountTokenA);
            const returns = dex.swap (pair, tokenB, tokenA, tokenBReturns);
            const profit = returns.tokenBReturns - amountTokenA;
            // this.pairs [pair].reserves [tokenA] += profit;
            // this.funds [tokenA] += profit * ;
            // add 5% of the profit to the funds
            const toFunds = profit * 0.05;
            this.funds [tokenA] += toFunds;
            this.stats [pair].profit [tokenA] += profit - toFunds;
            this.stats [pair].volume [tokenA] += amountTokenA;
            this.stats [pair].volume [tokenB] += tokenBReturns;
            this.stats [pair].trades++;
            return true;
        } else if (tokenAPrice < tokenAPriceDex && tokenBPrice > tokenBPriceDex) {
            // console.log ('swap', tokenB, 'for', tokenA, 'on', this.name);
            // console.log ('swap', tokenA, 'for', tokenB, 'on', dex.name);

            const reserves = this.pairs [pair].reserves;
            const reservesNeeded = reserves [tokenA] * tokenAPriceDex;
            const idealAmountTokenB = reservesNeeded - reserves [tokenB];
            // const amountTokenB = Math.min (idealAmountTokenB, reserves [tokenB] * 0.01, dex.pairs [pair].reserves [tokenB] * 0.01);
            const amountTokenB = Math.min (this.funds [tokenB], idealAmountTokenB, reserves [tokenB] * 0.01, dex.pairs [pair].reserves [tokenB] * 0.01);
            
            // console.log (`using ${amountTokenB} ${tokenB} to buy ${tokenA} on ${this.name}`);
            // simulate the swap on this dex
            const ignisim = this.simulateSwap (pair, tokenB, tokenA, amountTokenB);
            // simulate the swap on the other dex
            const dexsim = dex.simulateSwap (pair, tokenA, tokenB, ignisim.tokenBReturns);
            // calculate the profit
            const profitsim = dexsim.tokenBReturns - amountTokenB;
            const percentage = profitsim / amountTokenB * 100;

            if (percentage < 0.7) return false;

            const { tokenBReturns } = this.swap (pair, tokenB, tokenA, amountTokenB);
            const returns = dex.swap (pair, tokenA, tokenB, tokenBReturns);
            const profit = returns.tokenBReturns - amountTokenB;
            const toFunds = profit * 0.05;
            this.funds [tokenB] += toFunds;
            this.stats [pair].profit [tokenB] += profit - toFunds;
            this.stats [pair].volume [tokenB] += amountTokenB;
            this.stats [pair].volume [tokenA] += tokenBReturns;
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
const uniswapVolume = {
    SOL: 0,
    USDC: 0
};
const doRandomTradeOnIgnifi = false;
for (let i = 0; i < 200; i++) {
    const tokenA = uniswap.pairs['SOL/USDC'].composition [Math.floor (Math.random () * 2)];
    const tokenB = uniswap.pairs['SOL/USDC'].composition.find (t => t !== tokenA);
    const multiplier = Math.random () > 0.8 ? 0.025 : 0.02;
    const amountTokenA = Number ((Math.random () * uniswap.pairs['SOL/USDC'].reserves[tokenA] * multiplier).toFixed (2));
    uniswapVolume [tokenA] += amountTokenA;
    const { tokenBReturns } = uniswap.swap('SOL/USDC', tokenA, tokenB, amountTokenA);
    uniswapVolume [tokenB] += tokenBReturns;
    
    // do random trade on colossus
    doRandomTradeOnIgnifi && (() => {
        const multiplierCol = Math.random () > 0.9 ? 0.02 : 0.01;
        const tokenACol = uniswap.pairs['SOL/USDC'].composition [Math.floor (Math.random () * 2)];
        const tokenBCol = uniswap.pairs['SOL/USDC'].composition.find (t => t !== tokenACol);
        const amountTokenA2 = Number ((Math.random () * ignifi.pairs['SOL/USDC'].reserves[tokenACol] * multiplierCol).toFixed (2));
        const { tokenBReturns: tokenBReturns2 } = ignifi.swap ('SOL/USDC', tokenACol, tokenBCol, amountTokenA2);
        ignifi.stats ['SOL/USDC'].volume [tokenACol] += amountTokenA2;
        ignifi.stats ['SOL/USDC'].volume [tokenBCol] += tokenBReturns2;
    }) ();

    let iters = 0;
    while (ignifi.doArbitrage ('SOL/USDC', uniswap)) { iters++ };
    // console.log (iters);

    reservesLog.push (uniswap.pairs['SOL/USDC'].reserves);
    ignifiReservesLog.push (ignifi.pairs['SOL/USDC'].reserves);
}

// write the logs to json files
fs.writeFileSync ('./uniswapReserves.json', JSON.stringify (reservesLog));
fs.writeFileSync ('./colossusReserves.json', JSON.stringify (ignifiReservesLog));

console.log ('\n - Price -');

console.log ('<other dex>: price of SOL', uniswap.calcPrice ('SOL/USDC', 'SOL'));
console.log ('<igni.fi>: price of SOL', ignifi.calcPrice ('SOL/USDC', 'SOL'));

// calculate profit
const profit = ignifi.stats ['SOL/USDC'].profit;
const volume = ignifi.stats ['SOL/USDC'].volume;
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

const KIncludingProfit = reservesIncludingProfit.SOL * reservesIncludingProfit.USDC;


const KGrowthPercent = (finalK - initialK) / initialK * 100;
const KGrowthPercentIncludingProfit = (KIncludingProfit - initialK) / initialK * 100;
const KGrowthPercentUni = (finalUniK - initialUniswapK) / initialUniswapK * 100;

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
// console.log (`<other dex> final K: ${Math.round (finalUniK)} (${KGrowthPercentUni.toFixed (2)}% growth)`);

console.log ('\n - Reserves -');

// reserves

console.log (`<other dex> (LP): ${uniswap.pairs['SOL/USDC'].reserves.SOL.toFixed (8)} SOL`);
console.log (`<other dex> (LP): ${uniswap.pairs['SOL/USDC'].reserves.USDC.toFixed (8)} USDC`);
// total assets

// console.log ('\n- Total Assets -');

console.log (`<igni.fi> (LP): ${ignifi.pairs['SOL/USDC'].reserves.SOL.toFixed (8)} SOL`);
console.log (`<igni.fi> (LP): ${ignifi.pairs['SOL/USDC'].reserves.USDC.toFixed (8)} USDC`);

console.log (`<igni.fi> (LP + ARB): ${(ignifi.pairs ['SOL/USDC'].reserves ['SOL'] + ignifi.stats ['SOL/USDC'].profit ['SOL']).toFixed (8)} SOL`);
console.log (`<igni.fi> (LP + ARB): ${(ignifi.pairs ['SOL/USDC'].reserves ['USDC'] + ignifi.stats ['SOL/USDC'].profit ['USDC']).toFixed (8)} USDC`);

console.log ('\n- USDC Value -');

const ColossusUSDCValue = ignifi.pairs ['SOL/USDC'].reserves.USDC + ignifi.stats ['SOL/USDC'].profit ['USDC'] + (ignifi.pairs ['SOL/USDC'].reserves.SOL + ignifi.stats ['SOL/USDC'].profit ['SOL']) * uniswap.calcPrice ('SOL/USDC', 'SOL');
const UniswapUSDCValue = uniswap.pairs ['SOL/USDC'].reserves.USDC + uniswap.pairs ['SOL/USDC'].reserves.SOL * uniswap.calcPrice ('SOL/USDC', 'SOL');

console.log (`<other dex> (LP): ${UniswapUSDCValue.toFixed (8)} USDC`);
console.log (`<igni.fi> (LP + ARB): ${ColossusUSDCValue.toFixed (8)} USDC`);

const percentageGrowth = (ColossusUSDCValue - UniswapUSDCValue) / UniswapUSDCValue * 100;
console.log (`USDC delta: ${(ColossusUSDCValue - UniswapUSDCValue).toFixed (8)} USDC (${percentageGrowth.toFixed (2)}%)`);

console.log ('\n- K -');
console.log (`<other dex> initial K: ${Math.round (initialUniswapK)}`);
console.log (`<other dex> (LP): ${finalUniK.toFixed (8)} (+${KGrowthPercentUni.toFixed (2)}%)`);
console.log (`<igni.fi> initial K: ${Math.round (initialK)}`);
console.log (`<igni.fi> (LP): ${Math.round (finalK)} (${KGrowthPercent.toFixed (2)}% growth)`);
console.log (`<igni.fi> (LP + ARB): ${KIncludingProfit.toFixed (8)} (+${KGrowthPercentIncludingProfit.toFixed (2)}%)`);
console.log (`<igni.fi> K growth: ${(KGrowthPercentIncludingProfit / KGrowthPercentUni).toFixed (2)}x of <other dex>`);
// console.log (`<igni.fi> K growth (LP + PROFIT) ${KGrowthPercentIncludingProfit.toFixed (2)}%`);
