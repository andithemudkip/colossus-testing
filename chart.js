fetch ("./ignifiReserves.json").then(response => {
    return response.json();
}).then (async data => {
    console.log (data);
    const pricesIgnifi = data.filter ((d,i) => i % 2 === 0).map (d => Number ((d.USDC / d.SOL).toFixed(2)));
    console.log (pricesIgnifi);
    const uniswapData = await fetch ("./uniswapReserves.json");
    const uniswap = await uniswapData.json();
    const pricesUniswap = uniswap.filter ((d,i) => i % 2 === 0).map (d => Number ((d.USDC / d.SOL).toFixed(2)));
    var chart = bb.generate({
        bindto: "#chart",
        data: {
            columns: [
                ["igni.fi", ...pricesIgnifi],
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