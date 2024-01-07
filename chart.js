fetch ("./colossusReserves.json").then(response => {
    return response.json();
}).then (async data => {
    console.log (data);
    const pricesColossus = data.filter ((d,i) => i % 2 === 0).map (d => Number ((d.USDC / d.SOL).toFixed(2)));
    console.log (pricesColossus);
    const uniswapData = await fetch ("./uniswapReserves.json");
    const uniswap = await uniswapData.json();
    const pricesUniswap = uniswap.filter ((d,i) => i % 2 === 0).map (d => Number ((d.USDC / d.SOL).toFixed(2)));
    var chart = bb.generate({
        bindto: "#chart",
        data: {
            columns: [
                ["igni.fi", ...pricesColossus],
                ["Uniswap", ...pricesUniswap]
            ],
            types: {
                'igni.fi': "area-spline",
                Uniswap: "area-spline"
            },
            colors: {
                'igni.fi': "blue",
                Uniswap: "green"
            }
        }
    });
    chart.axis.range ({
        min: {
            y: 100
        }
    })
}
);
// bb.generate({
//     bindto: "#chart",
//     data: {
//         columns: [
//             ["Uniswap", 30, 200, 100, 170, 150, 250],
//             ["Colossal", 130, 100, 140, 35, 110, 50]
//         ],
//         types: {
//             Uniswap: "area-spline",
//             Colossal: "area-spline"
//         },
//         colors: {
//           JavaScript: "blue",
//           PHP: "green"
//         }
//     }
// });