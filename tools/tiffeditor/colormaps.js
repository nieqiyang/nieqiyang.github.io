// colormaps.js

const ColorMaps = {
    grayscale: (value) => { // value 0-1
        const C = Math.floor(value * 255);
        return [C, C, C];
    },
    viridis: (value) => { // value 0-1, simplified placeholder
        // Real Viridis has many color stops. This is a crude approximation.
        // See https://github.com/BIDS/colormap/blob/master/colormaps.py for actual values
        // For a simple example:
        const r = Math.floor(Math.sin(value * Math.PI) * 127 + Math.cos(value * Math.PI / 2) * 128);
        const g = Math.floor(Math.sin(value * Math.PI + 2 * Math.PI / 3) * 127 + Math.cos(value * Math.PI / 2 + Math.PI / 3) * 128);
        const b = Math.floor(Math.sin(value * Math.PI + 4 * Math.PI / 3) * 127 + Math.cos(value * Math.PI / 2 + 2 * Math.PI / 3) * 128);
        return [
            Math.max(0, Math.min(255, r)), 
            Math.max(0, Math.min(255, g)), 
            Math.max(0, Math.min(255, b))
        ];
    },
    plasma: (value) => { // Simplified placeholder
        const r = Math.floor(Math.sin(value * Math.PI * 1.5) * 200 + 55);
        const g = Math.floor(Math.cos(value * Math.PI * 0.8) * 100 + 155);
        const b = Math.floor(Math.sin(value * Math.PI * 0.5 + Math.PI/2) * 200 + 55);
        return [
            Math.max(0, Math.min(255, r)),
            Math.max(0, Math.min(255, g)),
            Math.max(0, Math.min(255, b))
        ];
    },
    // ... Add more colormaps (inferno, magma, cividis, terrain, etc.)
    // For 'terrain', you'd typically have distinct color bands for elevation ranges.
    terrain: (value) => { // Very simplified terrain-like colors
        if (value < 0.2) return [0, 0, 128]; // Deep blue
        if (value < 0.4) return [0, 128, 255]; // Light blue
        if (value < 0.5) return [255, 255, 128]; // Sand
        if (value < 0.7) return [0, 192, 0]; // Green
        if (value < 0.9) return [128, 128, 128]; // Grey (mountains)
        return [255, 255, 255]; // White (snow)
    }
};

function getColormapFunction(name) {
    return ColorMaps[name] || ColorMaps.grayscale;
}