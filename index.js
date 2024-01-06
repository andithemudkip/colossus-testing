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
        const tokenBReturns = reserves[tokenB] - newBReserves;
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
        let priceOfTokenB = newReserves[tokenA] / newReserves[tokenB];
        return {
            reserves: newReserves,
            tokenBReturns,
            priceOfTokenB
        };
    }
}

class Colossus extends DEX {
    constructor (name, pairs) {
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
            const amountTokenA = Math.min (idealAmountTokenA, reserves [tokenA] * 0.01, dex.pairs [pair].reserves [tokenA] * 0.01);

            // simulate the swap on this dex
            const colsim = this.simulateSwap (pair, tokenA, tokenB, amountTokenA);
            // simulate the swap on the other dex
            const dexsim = dex.simulateSwap (pair, tokenB, tokenA, colsim.tokenBReturns);
            // calculate the profit
            const profitsim = dexsim.tokenBReturns - amountTokenA;
            const percentage = profitsim / amountTokenA * 100;

            if (percentage < 1) return false;

            const { tokenBReturns } = this.swap (pair, tokenA, tokenB, amountTokenA);
            const returns = dex.swap (pair, tokenB, tokenA, tokenBReturns);
            const profit = returns.tokenBReturns - amountTokenA;
            // this.pairs [pair].reserves [tokenA] += profit;
            this.stats [pair].profit [tokenA] += profit;
            this.stats [pair].volume [tokenA] += amountTokenA;
            this.stats [pair].volume [tokenB] += tokenBReturns;
            this.stats [pair].trades++;
        } else if (tokenAPrice < tokenAPriceDex && tokenBPrice > tokenBPriceDex) {
            // console.log ('swap', tokenB, 'for', tokenA, 'on', this.name);
            // console.log ('swap', tokenA, 'for', tokenB, 'on', dex.name);

            const reserves = this.pairs [pair].reserves;
            const reservesNeeded = reserves [tokenA] * tokenAPriceDex;
            const idealAmountTokenB = reservesNeeded - reserves [tokenB];
            const amountTokenB = Math.min (idealAmountTokenB, reserves [tokenB] * 0.01, dex.pairs [pair].reserves [tokenB] * 0.01);

            // simulate the swap on this dex
            const colsim = this.simulateSwap (pair, tokenB, tokenA, amountTokenB);
            // simulate the swap on the other dex
            const dexsim = dex.simulateSwap (pair, tokenA, tokenB, colsim.tokenBReturns);
            // calculate the profit
            const profitsim = dexsim.tokenBReturns - amountTokenB;
            const percentage = profitsim / amountTokenB * 100;

            if (percentage < 1) return false;

            const { tokenBReturns } = this.swap (pair, tokenB, tokenA, amountTokenB);
            const returns = dex.swap (pair, tokenA, tokenB, tokenBReturns);
            const profit = returns.tokenBReturns - amountTokenB;
            // this.pairs [pair].reserves [tokenB] += profit;
            this.stats [pair].profit [tokenB] += profit;
            this.stats [pair].volume [tokenB] += amountTokenB;
            this.stats [pair].volume [tokenA] += tokenBReturns;
            this.stats [pair].trades++;
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

let colossus = new Colossus ('igni.fi', {
    'SOL/USDC': {
        composition: ['SOL', 'USDC'],
        reserves: {
            SOL: 1000,
            USDC: 250000
        }
    }
});


//tests

// console.log ('reserves', uniswap.pairs['SOL/USDC'].reserves);
// console.log ('price of SOL', uniswap.calcPrice('SOL/USDC', 'SOL'));
// console.log (uniswap.swap('SOL/USDC', 'USDC', 'SOL', 10000));
// console.log ('price of SOL', uniswap.calcPrice('SOL/USDC', 'SOL'));

// console.log ('\n');

// const amountUSDC = 1000;
// const { reserves, tokenBReturns, priceOfTokenB } = uniswap.simulateSwap('SOL/USDC', 'USDC', 'SOL', amountUSDC);
// console.log ('simulated: reserves', reserves);
// console.log ('simulated: swapped', amountUSDC, 'USDC', 'for', tokenBReturns.toFixed (2), 'SOL', 'at', priceOfTokenB.toFixed (2), 'USDC per SOL');
// uniswap.swap('SOL/USDC', 'USDC', 'SOL', amountUSDC);
// console.log ('actual: reserves', uniswap.pairs['SOL/USDC'].reserves);
// console.log ('actual: price of SOL', uniswap.calcPrice('SOL/USDC', 'SOL'));

// do 1000 random trades on uniswap
const initialK = colossus.calcK ('SOL/USDC');
const initialUniswapK = uniswap.calcK ('SOL/USDC');
const reservesLog = [];
const colossusReservesLog = [];
const uniswapVolume = {
    SOL: 0,
    USDC: 0
};
for (let i = 0; i < 200; i++) {
    const tokenA = uniswap.pairs['SOL/USDC'].composition [Math.floor (Math.random () * 2)];
    const tokenB = uniswap.pairs['SOL/USDC'].composition.find (t => t !== tokenA);
    const multiplier = Math.random () > 0.8 ? 0.04 : 0.02;
    const amountTokenA = Number ((Math.random () * uniswap.pairs['SOL/USDC'].reserves[tokenA] * multiplier).toFixed (2));
    uniswapVolume [tokenA] += amountTokenA;
    const { tokenBReturns } = uniswap.swap('SOL/USDC', tokenA, tokenB, amountTokenA);
    uniswapVolume [tokenB] += tokenBReturns;
    // (i % 50 == 0) && console.log ('>', amountTokenA, tokenA, '->', tokenBReturns.toFixed (2), tokenB, '@', uniswap.calcPrice ('SOL/USDC', 'SOL'), 'USDC', '/', 'SOL (k = ', uniswap.calcK ('SOL/USDC').toFixed (2) + ')');
    
    // do random trade on colossus
    // const multiplierCol = Math.random () > 0.97 ? 0.03 : 0.01;
    // const tokenACol = uniswap.pairs['SOL/USDC'].composition [Math.floor (Math.random () * 2)];
    // const tokenBCol = uniswap.pairs['SOL/USDC'].composition.find (t => t !== tokenACol);
    // const amountTokenA2 = Number ((Math.random () * colossus.pairs['SOL/USDC'].reserves[tokenACol] * multiplierCol).toFixed (2));
    // const { tokenBReturns: tokenBReturns2 } = colossus.swap ('SOL/USDC', tokenACol, tokenBCol, amountTokenA2);
    // colossus.stats ['SOL/USDC'].volume [tokenACol] += amountTokenA2;
    // colossus.stats ['SOL/USDC'].volume [tokenBCol] += tokenBReturns2;

    // for (let j = 0; j < 5; j++) {
    //     colossus.doArbitrage ('SOL/USDC', uniswap);
    // }
    
    // if (i % 1 === 0 || (Math.abs (uniswap.calcPrice ('SOL/USDC', 'SOL') - colossus.calcPrice ('SOL/USDC', 'SOL')) > 5)) {
    for (let j = 0; j < 5; j++) {
        colossus.doArbitrage ('SOL/USDC', uniswap);
    }
    // }

    reservesLog.push (uniswap.pairs['SOL/USDC'].reserves);
    colossusReservesLog.push (colossus.pairs['SOL/USDC'].reserves);
    // if (i % 70 === 0) {
    //     console.log ('>', amountTokenA, tokenA, '->', tokenBReturns.toFixed (2), tokenB, '@', uniswap.calcPrice ('SOL/USDC', 'SOL'), 'USDC', '/', 'SOL');
    //     console.log ('colossus:\t\t', colossus.calcPrice ('SOL/USDC', 'SOL').toFixed (8), 'USDC', '/', 'SOL');
    // }s
}

// write the logs to json files
fs.writeFileSync ('./uniswapReserves.json', JSON.stringify (reservesLog));
fs.writeFileSync ('./colossusReserves.json', JSON.stringify (colossusReservesLog));

console.log ('\n - Price -');

console.log ('<other dex>: price of SOL', uniswap.calcPrice ('SOL/USDC', 'SOL'));
console.log ('<igni.fi>: price of SOL', colossus.calcPrice ('SOL/USDC', 'SOL'));

// calculate profit
const profit = colossus.stats ['SOL/USDC'].profit;
const volume = colossus.stats ['SOL/USDC'].volume;
const percentage = {
    SOL: profit.SOL / volume.SOL * 100,
    USDC: profit.USDC / volume.USDC * 100
};
const finalK = colossus.calcK ('SOL/USDC');
const finalUniK = uniswap.calcK ('SOL/USDC');

const reservesIncludingProfit = {
    SOL: colossus.pairs ['SOL/USDC'].reserves ['SOL'] + colossus.stats ['SOL/USDC'].profit ['SOL'],
    USDC: colossus.pairs ['SOL/USDC'].reserves ['USDC'] + colossus.stats ['SOL/USDC'].profit ['USDC']
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
console.log (`<igni.fi> trades: ${colossus.stats ['SOL/USDC'].trades}`);

// console.log (`<other dex> final K: ${Math.round (finalUniK)} (${KGrowthPercentUni.toFixed (2)}% growth)`);

console.log ('\n - Reserves -');

// reserves

console.log (`<other dex> (LP): ${uniswap.pairs['SOL/USDC'].reserves.SOL.toFixed (8)} SOL`);
console.log (`<other dex> (LP): ${uniswap.pairs['SOL/USDC'].reserves.USDC.toFixed (8)} USDC`);
// total assets

// console.log ('\n- Total Assets -');

console.log (`<igni.fi> (LP): ${colossus.pairs['SOL/USDC'].reserves.SOL.toFixed (8)} SOL`);
console.log (`<igni.fi> (LP): ${colossus.pairs['SOL/USDC'].reserves.USDC.toFixed (8)} USDC`);

console.log (`<igni.fi> (LP + ARB): ${(colossus.pairs ['SOL/USDC'].reserves ['SOL'] + colossus.stats ['SOL/USDC'].profit ['SOL']).toFixed (8)} SOL`);
console.log (`<igni.fi> (LP + ARB): ${(colossus.pairs ['SOL/USDC'].reserves ['USDC'] + colossus.stats ['SOL/USDC'].profit ['USDC']).toFixed (8)} USDC`);

console.log ('\n- USDC Value -');

const ColossusUSDCValue = colossus.pairs ['SOL/USDC'].reserves.USDC + colossus.stats ['SOL/USDC'].profit ['USDC'] + (colossus.pairs ['SOL/USDC'].reserves.SOL + colossus.stats ['SOL/USDC'].profit ['SOL']) * uniswap.calcPrice ('SOL/USDC', 'SOL');
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

// console.log (`<igni.fi> K growth (LP + PROFIT) ${KGrowthPercentIncludingProfit.toFixed (2)}%`);
