// let uniswapTest = {
//     pairs: {
//         'ETH/USDC': {
//             composition: ['ETH', 'USDC'],
//             reserves: {
//                 ETH: 100,
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

const csv = require ('csv-parse');
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
            'ETH/USDC': {
                volume: {
                    ETH: 0,
                    USDC: 0
                },
                profit: {
                    ETH: 0,
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

            if (percentage < 0.2) return false;

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
    'ETH/USDC': {
        composition: ['ETH', 'USDC'],
        reserves: {
            ETH: 100,
            USDC: 250000
        }
    }
});

let colossus = new Colossus ('colossus', {
    'ETH/USDC': {
        composition: ['ETH', 'USDC'],
        reserves: {
            ETH: 100,
            USDC: 250000
        }
    }
});


//tests

// console.log ('reserves', uniswap.pairs['ETH/USDC'].reserves);
// console.log ('price of ETH', uniswap.calcPrice('ETH/USDC', 'ETH'));
// console.log (uniswap.swap('ETH/USDC', 'USDC', 'ETH', 10000));
// console.log ('price of ETH', uniswap.calcPrice('ETH/USDC', 'ETH'));

// console.log ('\n');

// const amountUSDC = 1000;
// const { reserves, tokenBReturns, priceOfTokenB } = uniswap.simulateSwap('ETH/USDC', 'USDC', 'ETH', amountUSDC);
// console.log ('simulated: reserves', reserves);
// console.log ('simulated: swapped', amountUSDC, 'USDC', 'for', tokenBReturns.toFixed (2), 'ETH', 'at', priceOfTokenB.toFixed (2), 'USDC per ETH');
// uniswap.swap('ETH/USDC', 'USDC', 'ETH', amountUSDC);
// console.log ('actual: reserves', uniswap.pairs['ETH/USDC'].reserves);
// console.log ('actual: price of ETH', uniswap.calcPrice('ETH/USDC', 'ETH'));

// do 1000 random trades on uniswap
const initialK = colossus.calcK ('ETH/USDC');
const initialUniswapK = uniswap.calcK ('ETH/USDC');
const reservesLog = [];
const colossusReservesLog = [];
const uniswapVolume = {
    ETH: 0,
    USDC: 0
};
for (let i = 0; i < 200; i++) {
    const tokenA = uniswap.pairs['ETH/USDC'].composition [Math.floor (Math.random () * 2)];
    const tokenB = uniswap.pairs['ETH/USDC'].composition.find (t => t !== tokenA);
    // choose a random amount of tokenA that is under 0.5% of the reserves
    const amountTokenA = Number ((Math.random () * uniswap.pairs['ETH/USDC'].reserves[tokenA] * 0.1).toFixed (2));
    uniswapVolume [tokenA] += amountTokenA;
    for (let j = 0; j < 20; j++) {
        colossus.doArbitrage ('ETH/USDC', uniswap);
    }
    const { tokenBReturns } = uniswap.swap('ETH/USDC', tokenA, tokenB, amountTokenA);
    uniswapVolume [tokenB] += tokenBReturns;
    // (i % 50 == 0) && console.log ('>', amountTokenA, tokenA, '->', tokenBReturns.toFixed (2), tokenB, '@', uniswap.calcPrice ('ETH/USDC', 'ETH'), 'USDC', '/', 'ETH (k = ', uniswap.calcK ('ETH/USDC').toFixed (2) + ')');
    reservesLog.push (uniswap.pairs['ETH/USDC'].reserves);
    colossusReservesLog.push (colossus.pairs['ETH/USDC'].reserves);
    // if (i % 70 === 0) {
    //     console.log ('>', amountTokenA, tokenA, '->', tokenBReturns.toFixed (2), tokenB, '@', uniswap.calcPrice ('ETH/USDC', 'ETH'), 'USDC', '/', 'ETH');
    //     console.log ('colossus:\t\t', colossus.calcPrice ('ETH/USDC', 'ETH').toFixed (8), 'USDC', '/', 'ETH');
    // }
}

// write the logs to json files
fs.writeFileSync ('./uniswapReserves.json', JSON.stringify (reservesLog));
fs.writeFileSync ('./colossusReserves.json', JSON.stringify (colossusReservesLog));



// const csvContent = fs.readFileSync ('./bitstampUSD_1-min_data_2012-01-01_to_2021-03-31.csv');
// const records = csv.parse (csvContent, {
//     bom: true,
//     columns: true
// }, (err, records) => {
//     if (err) throw err;
//     // console.log (records.length);
//     records = records.filter (r => r.Weighted_Price !== 'NaN');
//     records = records.filter ((r, i) => i % 10 === 0);
//     console.log (records.length);
// });

console.log ('\n');

console.log ('uniswap: price of ETH', uniswap.calcPrice ('ETH/USDC', 'ETH'));
console.log ('colossus: price of ETH', colossus.calcPrice ('ETH/USDC', 'ETH'));

// calculate profit
const profit = colossus.stats ['ETH/USDC'].profit;
const volume = colossus.stats ['ETH/USDC'].volume;
const percentage = {
    ETH: profit.ETH / volume.ETH * 100,
    USDC: profit.USDC / volume.USDC * 100
};
const finalK = colossus.calcK ('ETH/USDC');
const finalUniK = uniswap.calcK ('ETH/USDC');
const KGrowthPercent = (finalK - initialK) / initialK * 100;
const KGrowthPercentUni = (finalUniK - initialUniswapK) / initialUniswapK * 100;
console.log (`profit: ${profit.ETH.toFixed (8)} ETH (${percentage.ETH.toFixed (2)}% of volume)`);
console.log (`profit: ${profit.USDC.toFixed (8)} USDC (${percentage.USDC.toFixed (2)}% of volume)`);
console.log (`volume: ${volume.ETH.toFixed (8)} ETH`);
console.log (`volume: ${volume.USDC.toFixed (8)} USDC`);
console.log (`trades: ${colossus.stats ['ETH/USDC'].trades}`);
console.log (`initial K: ${Math.round (initialK)}`);
console.log (`final K: ${Math.round (finalK)} (${KGrowthPercent.toFixed (2)}% growth)`);
console.log (`uniswap volume: ${uniswapVolume.ETH.toFixed (8)} ETH`);
console.log (`uniswap volume: ${uniswapVolume.USDC.toFixed (8)} USDC`);
console.log (`uniswap initial K: ${Math.round (initialUniswapK)}`);
console.log (`uniswap final K: ${Math.round (finalUniK)} (${KGrowthPercentUni.toFixed (2)}% growth)`);

console.log ('\n');

// reserves

console.log (`uniswap (LP): ${uniswap.pairs['ETH/USDC'].reserves.ETH.toFixed (8)} ETH`);
console.log (`uniswap (LP): ${uniswap.pairs['ETH/USDC'].reserves.USDC.toFixed (8)} USDC`);
// total assets

console.log (`colossus (LP + PROFIT): ${(colossus.pairs ['ETH/USDC'].reserves ['ETH'] + colossus.stats ['ETH/USDC'].profit ['ETH']).toFixed (8)} ETH`);
console.log (`colossus (LP + PROFIT): ${(colossus.pairs ['ETH/USDC'].reserves ['USDC'] + colossus.stats ['ETH/USDC'].profit ['USDC']).toFixed (8)} USDC`);

console.log (`colossus (LP): ${colossus.pairs['ETH/USDC'].reserves.ETH.toFixed (8)} ETH`);
console.log (`colossus (LP): ${colossus.pairs['ETH/USDC'].reserves.USDC.toFixed (8)} USDC`);

console.log ('\n');

const ColossusUSDCValue = colossus.pairs ['ETH/USDC'].reserves.USDC + colossus.stats ['ETH/USDC'].profit ['USDC'] + (colossus.pairs ['ETH/USDC'].reserves.ETH + colossus.stats ['ETH/USDC'].profit ['ETH']) * uniswap.calcPrice ('ETH/USDC', 'ETH');
const UniswapUSDCValue = uniswap.pairs ['ETH/USDC'].reserves.USDC + uniswap.pairs ['ETH/USDC'].reserves.ETH * uniswap.calcPrice ('ETH/USDC', 'ETH');

console.log (`colossus (LP + PROFIT): ${ColossusUSDCValue.toFixed (8)} USDC`);
console.log (`uniswap (LP): ${UniswapUSDCValue.toFixed (8)} USDC`);

console.log (`delta: ${(ColossusUSDCValue - UniswapUSDCValue).toFixed (8)} USDC`);
