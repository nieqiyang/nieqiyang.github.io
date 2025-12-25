// script.js
const { GeoTIFF, fromArrayBuffer, writeArrayBuffer } = window.GeoTIFF; // Assuming geotiff.js is loaded globally

// --- DOM Elements ---
const fileInput = document.getElementById('fileInput');
const saveButton = document.getElementById('saveButton');
const saveAsButton = document.getElementById('saveAsButton');
const undoButton = document.getElementById('undoButton');
const redoButton = document.getElementById('redoButton');
const locateMaxButton = document.getElementById('locateMaxButton');
const locateMinButton = document.getElementById('locateMinButton');
const locateNaNButton = document.getElementById('locateNaNButton');
const replaceAllNaNButton = document.getElementById('replaceAllNaNButton');
const zoomInButton = document.getElementById('zoomInButton');
const zoomOutButton = document.getElementById('zoomOutButton');
const zoomActualButton = document.getElementById('zoomActualButton');
const colormapSelect = document.getElementById('colormapSelect');
const brushSizeSlider = document.getElementById('brushSize');
const brushSizeValueSpan = document.getElementById('brushSizeValue');
const currentValueInput = document.getElementById('currentValue');
const setNaNCheckbox = document.getElementById('setNaNCheckbox');
const toolBrushRadio = document.getElementById('toolBrush');
const toolPickerRadio = document.getElementById('toolPicker');
const showPixelValuesCheckbox = document.getElementById('showPixelValuesCheckbox');
const zoomInput = document.getElementById('zoomInput');
const zoomApplyButton = document.getElementById('zoomApplyButton');

const canvas = document.getElementById('imageCanvas');
const ctx = canvas.getContext('2d');
const canvasContainer = document.querySelector('.canvas-container');

const coordInfoSpan = document.getElementById('coordInfo');
const valueAtCursorInfoSpan = document.getElementById('valueAtCursorInfo');
const currentSetValueInfoSpan = document.getElementById('currentSetValueInfo');
const minInfoSpan = document.getElementById('minInfo');
const maxInfoSpan = document.getElementById('maxInfo');
const nanInfoSpan = document.getElementById('nanInfo');
const statusBar = document.getElementById('statusBar');

const nanReplaceModal = document.getElementById('nanReplaceModal');
const nanReplaceTitle = document.getElementById('nanReplaceTitle');
const confirmNanReplaceButton = document.getElementById('confirmNanReplaceButton');
const replaceNanConstantValueInput = document.getElementById('replaceNanConstantValue');
const replaceNanStatisticTypeSelect = document.getElementById('replaceNanStatisticType');


// --- App State ---
let originalFileName = null;
let tiffImage = null; // geotiff.js image object
let imageDataArray = null; // Float32Array of pixel values
let imageWidth = 0;
let imageHeight = 0;
let minValue = 0;
let maxValue = 1;
let nanCount = 0;
let geoTransform = null;
let projection = null;
let metadata = {}; // To store other TIFF tags

let currentTool = 'brush'; // 'brush' or 'picker'
let currentBrushSize = 1;
let currentSetValue = 0.0;
let useNaN = false;

let zoomFactor = 1.0;
let panX = 0; // Pan offset in image coordinates
let panY = 0;

const undoStack = [];
const redoStack = [];
const MAX_UNDO_STACK_SIZE = 20;

let isDragging = false;
let lastDragPosition = null;
let pixelValueTexts = [];


// --- Initialization ---
function initialize() {
    updateInfoPanel();
    updateToolbarControls();

    fileInput.addEventListener('change', handleFileOpen);
    saveButton.addEventListener('click', handleSave);
    saveAsButton.addEventListener('click', handleSaveAs);
    
    undoButton.addEventListener('click', () => doUndo());
    redoButton.addEventListener('click', () => doRedo());
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            doUndo();
        }
        if (e.ctrlKey && e.key === 'y') {
            e.preventDefault();
            doRedo();
        }
    });

    locateMaxButton.addEventListener('click', locateMaxValue);
    locateMinButton.addEventListener('click', locateMinValue);
    locateNaNButton.addEventListener('click', locateFirstNaN);
    replaceAllNaNButton.addEventListener('click', openReplaceNaNModal);
    confirmNanReplaceButton.addEventListener('click', handleReplaceAllNaN);

    zoomInButton.addEventListener('click', () => applyZoom(1.2));
    zoomOutButton.addEventListener('click', () => applyZoom(0.8));
    zoomActualButton.addEventListener('click', () => setAbsoluteZoom(1.0));
    zoomApplyButton.addEventListener('click', () => {
        const val = parseFloat(zoomInput.value) / 100;
        if (!isNaN(val) && val > 0) setAbsoluteZoom(val);
    });
    zoomInput.addEventListener('change', () => { // Also apply on Enter or blur
         const val = parseFloat(zoomInput.value) / 100;
        if (!isNaN(val) && val > 0) setAbsoluteZoom(val);
    });


    colormapSelect.addEventListener('change', () => {
        if (imageDataArray) renderImage();
    });

    brushSizeSlider.addEventListener('input', (e) => {
        currentBrushSize = parseInt(e.target.value);
        brushSizeValueSpan.textContent = currentBrushSize;
    });
    currentValueInput.addEventListener('change', (e) => {
        currentSetValue = parseFloat(e.target.value);
        if (isNaN(currentSetValue)) currentSetValue = 0; // Default if invalid
        currentSetValueInfoSpan.textContent = `当前设置值: ${useNaN ? 'NaN' : currentSetValue.toFixed(2)}`;
    });
    setNaNCheckbox.addEventListener('change', (e) => {
        useNaN = e.target.checked;
        currentSetValueInfoSpan.textContent = `当前设置值: ${useNaN ? 'NaN' : currentSetValue.toFixed(2)}`;
    });
    
    toolBrushRadio.addEventListener('change', () => currentTool = 'brush');
    toolPickerRadio.addEventListener('change', () => currentTool = 'picker');
    
    showPixelValuesCheckbox.addEventListener('change', () => {
        if (imageDataArray) renderImage(); // Re-render to show/hide values
    });

    canvas.addEventListener('mousedown', handleCanvasMouseDown);
    canvas.addEventListener('mousemove', handleCanvasMouseMove);
    canvas.addEventListener('mouseup', handleCanvasMouseUp);
    canvas.addEventListener('mouseleave', handleCanvasMouseLeave);
    canvas.addEventListener('wheel', handleCanvasWheel, { passive: false }); // For zoom

    // Set initial values
    currentBrushSize = parseInt(brushSizeSlider.value);
    brushSizeValueSpan.textContent = currentBrushSize;
    currentSetValue = parseFloat(currentValueInput.value);
    currentSetValueInfoSpan.textContent = `当前设置值: ${currentSetValue.toFixed(2)}`;
    zoomInput.value = Math.round(zoomFactor * 100);
}

// --- File Handling ---
async function handleFileOpen(event) {
    const file = event.target.files[0];
    if (!file) return;

    originalFileName = file.name;
    statusBar.textContent = `正在加载: ${file.name}...`;

    try {
        const arrayBuffer = await file.arrayBuffer();
        const tiff = await fromArrayBuffer(arrayBuffer);
        tiffImage = await tiff.getImage(); // Get the first image

        imageWidth = tiffImage.getWidth();
        imageHeight = tiffImage.getHeight();
        
        // Try to get GeoTIFF specific info
        try {
            geoTransform = tiffImage.getGeoTransform ? tiffImage.getGeoTransform() : null; // Might not exist on all tiff.js versions or files
            projection = tiffImage.getProjection ? tiffImage.getProjection() : null; // Might not exist
            const fileDirectory = tiffImage.getFileDirectory();
            metadata = {}; // Reset
             if (fileDirectory) { // Basic TIFF tags
                for (const key in fileDirectory) {
                    if (typeof fileDirectory[key] !== 'function' && key !== 'StripOffsets' && key !== 'StripByteCounts' && key !== 'TileOffsets' && key !== 'TileByteCounts') {
                         // Avoid very large array tags for general metadata storage
                        if (Array.isArray(fileDirectory[key]) && fileDirectory[key].length > 20) {
                            metadata[key] = `Array[${fileDirectory[key].length}]`;
                        } else {
                            metadata[key] = fileDirectory[key];
                        }
                    }
                }
            }
             // geotiff.js might also store original GDAL metadata if available
            if (tiffImage.getGDALMetadata) {
                const gdalMeta = tiffImage.getGDALMetadata();
                if (gdalMeta) {
                    metadata.GDAL = gdalMeta;
                }
            }


        } catch (geoError) {
            console.warn("Could not read GeoTIFF specific metadata:", geoError);
            geoTransform = null;
            projection = null;
        }


        const rasters = await tiffImage.readRasters({ interleave: false }); // Get data as Float32Array by default
        if (rasters.length > 0) {
            // Assuming single band for now, like the Python code
            imageDataArray = rasters[0]; 
            if (!(imageDataArray instanceof Float32Array)) {
                 // If it's not Float32Array, try to convert. geotiff.js usually returns typed arrays.
                console.warn("Raster data is not Float32Array, attempting conversion. Type:", imageDataArray.constructor.name);
                imageDataArray = new Float32Array(imageDataArray);
            }
        } else {
            throw new Error("No raster data found in TIFF.");
        }

        // Reset view
        panX = 0;
        panY = 0;
        setAbsoluteZoom(1.0); // Fit to view initially might be better, or 100%

        updateMinMaxNan();
        updateInfoPanel();
        clearUndoRedo();
        pushToUndoStack(imageDataArray); // Initial state

        renderImage();
        statusBar.textContent = `已加载: ${file.name} | 尺寸: ${imageWidth}x${imageHeight} | ${geoTransform ? '有地理信息' : '无地理信息'}`;

    } catch (error) {
        console.error("Error opening TIFF:", error);
        statusBar.textContent = `错误: ${error.message}`;
        alert(`无法打开图像: ${error.message}`);
        imageDataArray = null;
        originalFileName = null;
    }
}

async function handleSave() {
    if (!imageDataArray || !originalFileName) {
        handleSaveAs(); // If no original name, prompt for one
        return;
    }
    await doSave(originalFileName);
}

async function handleSaveAs() {
    if (!imageDataArray) {
        alert("没有图像数据可保存。");
        return;
    }
    const fileName = prompt("请输入文件名 (.tif):", originalFileName || "edited_image.tif");
    if (fileName) {
        await doSave(fileName);
    }
}

async function doSave(fileName) {
    if (!imageDataArray) return;
    statusBar.textContent = "正在保存...";
    try {
        // geotiff.js writeArrayBuffer expects an object with width, height, and values (typed array)
        // It can also take metadata like ModelPixelScaleTag, ModelTiepointTag, GeoKeyDirectoryTag for GeoTIFF
        const values = imageDataArray;
        
        const tiffMetadata = {
            width: imageWidth,
            height: imageHeight,
            // SampleFormat: [3], // For Float32
            // BitsPerSample: [32],
            // SamplesPerPixel: 1,
            // PhotometricInterpretation: 1, // BlackIsZero
        };

        // Attempt to add GeoTIFF metadata if available
        // This part is tricky and depends on how geotiff.js handles these.
        // You might need to convert GDAL GeoTransform to ModelTiepointTag and ModelPixelScaleTag
        // Or provide GeoKeyDirectoryTag directly.
        // Example (needs careful construction based on geotiff.js docs for writing):
        if (geoTransform) {
            // ModelTiepointTag: (0,0,0, UpperLeftX, UpperLeftY, 0.0)
            // ModelPixelScaleTag: (PixelWidth, PixelHeight, 0.0)
            // This is a simplified interpretation. GeoTIFF tags are complex.
             tiffMetadata.GeoTransform = geoTransform; // Newer geotiff.js might take this directly
             // Or convert:
             // tiffMetadata.ModelTiepoint = [0, 0, 0, geoTransform[0], geoTransform[3], 0];
             // tiffMetadata.ModelPixelScale = [geoTransform[1], Math.abs(geoTransform[5]), 0]; // geoTransform[5] is often negative
        }
        if (projection) { // WKT string for projection
            tiffMetadata.GeoProjection = projection; // Newer geotiff.js might take this
            // Or requires specific GeoKeys
            // tiffMetadata.GeoKeyDirectoryTag = { ... } // Complex to construct
        }
        // Add other simple metadata if possible
        // for (const key in metadata) {
        //     if (key !== 'GDAL' && !tiffMetadata[key] && (typeof metadata[key] === 'number' || typeof metadata[key] === 'string')) {
        //         tiffMetadata[key] = metadata[key];
        //     }
        // }


        const arrayBuffer = await writeArrayBuffer(values, tiffMetadata);
        const blob = new Blob([arrayBuffer], { type: 'image/tiff' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName.endsWith('.tif') || fileName.endsWith('.tiff') ? fileName : fileName + ".tif";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

        statusBar.textContent = `图像已保存为: ${fileName}`;
    } catch (error) {
        console.error("Error saving TIFF:", error);
        statusBar.textContent = `保存错误: ${error.message}`;
        alert(`保存图像时出错: ${error.message}`);
    }
}


// --- Image Data Logic ---
function updateMinMaxNan() {
    if (!imageDataArray) return;
    let min = Infinity;
    let max = -Infinity;
    let countNaN = 0;
    for (let i = 0; i < imageDataArray.length; i++) {
        const val = imageDataArray[i];
        if (Number.isNaN(val)) {
            countNaN++;
        } else {
            if (val < min) min = val;
            if (val > max) max = val;
        }
    }
    minValue = (min === Infinity) ? 0 : min; // Handle all-NaN case
    maxValue = (max === -Infinity) ? 1 : max;
    if (minValue === maxValue) { // Handle case where all valid values are the same
        if (minValue === 0) maxValue = 1; // Avoid division by zero if all are 0
        else minValue = minValue - 0.5 * Math.abs(minValue); // Create a small range
             maxValue = maxValue + 0.5 * Math.abs(maxValue);
        if (minValue === maxValue) maxValue = minValue + 1; // Ultimate fallback
    }
    nanCount = countNaN;
}

function getPixelValue(x, y) {
    if (!imageDataArray || x < 0 || x >= imageWidth || y < 0 || y >= imageHeight) {
        return NaN;
    }
    return imageDataArray[y * imageWidth + x];
}

function setPixelValue(x, y, value, recordUndo = true) {
    if (!imageDataArray || x < 0 || x >= imageWidth || y < 0 || y >= imageHeight) {
        return false; // Out of bounds
    }
    const index = y * imageWidth + x;
    if (imageDataArray[index] === value || (Number.isNaN(imageDataArray[index]) && Number.isNaN(value))) {
        return false; // No change
    }
    if (recordUndo && !isDragging) { // Only push full state for single click or start of drag
        pushToUndoStack(imageDataArray);
    }
    imageDataArray[index] = value;
    return true; // Value changed
}

// --- Rendering ---
function renderImage() {
    if (!imageDataArray) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    // Adjust canvas element size to match CSS-defined container size
    // This ensures crisp rendering.
    const displayWidth = canvasContainer.clientWidth;
    const displayHeight = canvasContainer.clientHeight;
    if (canvas.width !== displayWidth) canvas.width = displayWidth;
    if (canvas.height !== displayHeight) canvas.height = displayHeight;

    ctx.imageSmoothingEnabled = false; // For pixelated look when zoomed
    // For very high zoom, an alternative rendering might be needed for performance
    // if (zoomFactor > 10) ctx.imageSmoothingEnabled = false; else ctx.imageSmoothingEnabled = true;


    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    // Calculate the visible portion of the image in image coordinates
    const viewPortWidthImageCoords = canvas.width / zoomFactor;
    const viewPortHeightImageCoords = canvas.height / zoomFactor;

    // Clamp panX and panY so we don't pan outside the image bounds too much
    // (Allow some overpan for easier navigation at edges)
    // These are the top-left image coordinates visible in the viewport
    let currentPanX = panX;
    let currentPanY = panY;
    
    // Translate to the pan position, then scale
    // The canvas (0,0) point will correspond to (panX, panY) in image coordinates *before* scaling.
    // So, to draw image pixel (ix, iy) at canvas pixel (cx, cy):
    // cx = (ix - panX) * zoomFactor
    // cy = (iy - panY) * zoomFactor
    ctx.scale(zoomFactor, zoomFactor);
    ctx.translate(-currentPanX, -currentPanY);

    const startX = Math.floor(Math.max(0, currentPanX));
    const startY = Math.floor(Math.max(0, currentPanY));
    const endX = Math.ceil(Math.min(imageWidth, currentPanX + viewPortWidthImageCoords + 1));
    const endY = Math.ceil(Math.min(imageHeight, currentPanY + viewPortHeightImageCoords + 1));
    
    const colormapFn = getColormapFunction(colormapSelect.value);
    const range = (maxValue - minValue) || 1; // Avoid division by zero

    // Option 1: Draw pixel by pixel (can be slow for large views)
    // This is more flexible for custom rendering per pixel
    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            const val = imageDataArray[y * imageWidth + x];
            let r, g, b, a = 255;
            if (Number.isNaN(val)) {
                [r, g, b] = [128, 128, 128]; // Gray for NaN
                a = 128; // Semi-transparent
            } else {
                const normalized = (val - minValue) / range;
                [r, g, b] = colormapFn(Math.max(0, Math.min(1, normalized))); // Clamp to 0-1
            }
            ctx.fillStyle = `rgba(${r},${g},${b},${a/255})`;
            ctx.fillRect(x, y, 1, 1); // Draw a 1x1 pixel in image coordinates
        }
    }

    // Option 2: Use putImageData (often faster for full redraws, but needs an ImageData object)
    // This would require creating an ImageData buffer for the visible part.
    // const iData = ctx.createImageData(endX - startX, endY - startY);
    // const data = iData.data;
    // let offset = 0;
    // for (let y = startY; y < endY; y++) {
    //     for (let x = startX; x < endX; x++) {
    //         const val = imageDataArray[y * imageWidth + x];
    //         let r, g, b, a = 255;
    //         if (Number.isNaN(val)) { ... } else { ... }
    //         data[offset++] = r; data[offset++] = g; data[offset++] = b; data[offset++] = a;
    //     }
    // }
    // ctx.putImageData(iData, startX, startY);


    ctx.restore(); // Restore transform

    // Draw pixel value texts if enabled and zoomed enough
    // This needs to be done in screen coordinates AFTER restoring context
    clearPixelValueTexts();
    if (showPixelValuesCheckbox.checked && zoomFactor >= 15) { // Only show if pixels are large enough
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                // Calculate canvas coordinates for the center of the pixel
                const cx = (x + 0.5 - currentPanX) * zoomFactor;
                const cy = (y + 0.5 - currentPanY) * zoomFactor;

                // Only draw if center is visible
                if (cx > -10 && cx < canvas.width + 10 && cy > -10 && cy < canvas.height + 10) {
                    const val = imageDataArray[y * imageWidth + x];
                    const text = Number.isNaN(val) ? "NaN" : val.toFixed(1);
                    
                    const textElement = document.createElement('div');
                    textElement.className = 'pixel-value-text';
                    textElement.style.left = `${cx - ctx.measureText(text).width/2 - 2}px`; // Approximate centering
                    textElement.style.top = `${cy - 6}px`; // Approximate centering
                    textElement.textContent = text;
                    canvasContainer.appendChild(textElement);
                    pixelValueTexts.push(textElement);
                }
            }
        }
    }
}

function clearPixelValueTexts() {
    pixelValueTexts.forEach(el => el.remove());
    pixelValueTexts = [];
}


// --- UI Updates ---
function updateInfoPanel() {
    if (imageDataArray) {
        minInfoSpan.textContent = `最小值: ${minValue.toFixed(2)}`;
        maxInfoSpan.textContent = `最大值: ${maxValue.toFixed(2)}`;
        nanInfoSpan.textContent = `NaN数量: ${nanCount}`;
    } else {
        minInfoSpan.textContent = "最小值: N/A";
        maxInfoSpan.textContent = "最大值: N/A";
        nanInfoSpan.textContent = "NaN数量: 0";
    }
    currentSetValueInfoSpan.textContent = `当前设置值: ${useNaN ? 'NaN' : currentSetValue.toFixed(2)}`;
}

function updateToolbarControls() {
    brushSizeSlider.value = currentBrushSize;
    brushSizeValueSpan.textContent = currentBrushSize;
    currentValueInput.value = currentSetValue;
    setNaNCheckbox.checked = useNaN;
    toolBrushRadio.checked = currentTool === 'brush';
    toolPickerRadio.checked = currentTool === 'picker';
    zoomInput.value = Math.round(zoomFactor * 100);
}

// --- Canvas Event Handlers ---
function getMousePosOnCanvas(event) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
}

function canvasToImageCoords(canvasX, canvasY) {
    // Inverse of render logic:
    // canvasX = (imageX - panX) * zoomFactor  => imageX = canvasX / zoomFactor + panX
    // canvasY = (imageY - panY) * zoomFactor  => imageY = canvasY / zoomFactor + panY
    const imageX = Math.floor(canvasX / zoomFactor + panX);
    const imageY = Math.floor(canvasY / zoomFactor + panY);
    return { x: imageX, y: imageY };
}

function imageToCanvasCoords(imageX, imageY) {
    const canvasX = (imageX - panX) * zoomFactor;
    const canvasY = (imageY - panY) * zoomFactor;
    return { x: canvasX, y: canvasY };
}


function handleCanvasMouseDown(event) {
    if (!imageDataArray) return;
    isDragging = true;
    const canvasPos = getMousePosOnCanvas(event);
    const imagePos = canvasToImageCoords(canvasPos.x, canvasPos.y);

    if (event.button === 0) { // Left click
        if (currentTool === 'brush') {
            pushToUndoStack(imageDataArray); // Push state at the beginning of a brush stroke
            applyBrush(imagePos.x, imagePos.y);
            lastDragPosition = imagePos; // For continuous brushing
        } else if (currentTool === 'picker') {
            pickValue(imagePos.x, imagePos.y);
        }
    } else if (event.button === 1 || (event.button === 0 && event.ctrlKey)) { // Middle mouse or Ctrl+Left for panning
        // Allow panning with middle mouse or ctrl+click
        isDragging = 'pan'; // Special state for panning
        lastDragPosition = { x: event.clientX, y: event.clientY }; // Screen coords for panning
    }
}

function handleCanvasMouseMove(event) {
    if (!imageDataArray) return;
    const canvasPos = getMousePosOnCanvas(event);
    const imagePos = canvasToImageCoords(canvasPos.x, canvasPos.y);

    coordInfoSpan.textContent = `坐标: (${imagePos.x}, ${imagePos.y})`;
    const valAtCursor = getPixelValue(imagePos.x, imagePos.y);
    valueAtCursorInfoSpan.textContent = `光标处值: ${Number.isNaN(valAtCursor) ? 'NaN' : valAtCursor.toFixed(2)}`;

    if (isDragging && event.buttons === 1) { // Left button down
        if (currentTool === 'brush' && isDragging !== 'pan') {
            if (lastDragPosition && (imagePos.x !== lastDragPosition.x || imagePos.y !== lastDragPosition.y)) {
                // Basic line drawing between points for smoother brushing on fast drags
                // This could be improved with Bresenham's line algorithm
                applyLineBrush(lastDragPosition, imagePos);
                lastDragPosition = imagePos;
            } else if (!lastDragPosition) { // Single click drag start
                applyBrush(imagePos.x, imagePos.y);
                lastDragPosition = imagePos;
            }
        }
    }
    if (isDragging === 'pan' && (event.buttons === 4 || (event.buttons === 1 && event.ctrlKey))) { // Middle mouse drag or Ctrl+Left Drag
        const dxScreen = event.clientX - lastDragPosition.x;
        const dyScreen = event.clientY - lastDragPosition.y;

        panX -= dxScreen / zoomFactor;
        panY -= dyScreen / zoomFactor;

        // Clamp panning
        panX = Math.max(0 - imageWidth * 0.1, Math.min(imageWidth * 1.1 - canvas.width / zoomFactor, panX));
        panY = Math.max(0 - imageHeight * 0.1, Math.min(imageHeight * 1.1 - canvas.height / zoomFactor, panY));


        lastDragPosition = { x: event.clientX, y: event.clientY };
        renderImage();
    }
}

function handleCanvasMouseUp(event) {
    if (isDragging && currentTool === 'brush' && isDragging !== 'pan') {
        // Brushing finished, update min/max/nan and info panel
        updateMinMaxNan();
        updateInfoPanel();
        renderImage(); // Final render for the stroke
    }
    isDragging = false;
    lastDragPosition = null;
}

function handleCanvasMouseLeave(event) {
    // Optional: if you want to stop dragging if mouse leaves canvas
    // if (isDragging && currentTool === 'brush') {
    //     updateMinMaxNan(); updateInfoPanel(); renderImage();
    // }
    // isDragging = false;
    // lastDragPosition = null;
    coordInfoSpan.textContent = "坐标: N/A";
    valueAtCursorInfoSpan.textContent = "光标处值: N/A";
}

function handleCanvasWheel(event) {
    if (!imageDataArray) return;
    event.preventDefault();

    const delta = event.deltaY > 0 ? 0.9 : 1.1; // Zoom factor change
    
    // Zoom relative to mouse cursor
    const canvasPos = getMousePosOnCanvas(event);
    const imagePosBeforeZoom = canvasToImageCoords(canvasPos.x, canvasPos.y);

    applyZoom(delta); // This updates zoomFactor

    const imagePosAfterZoom = canvasToImageCoords(canvasPos.x, canvasPos.y);

    // Adjust pan to keep the point under the cursor stationary
    panX += (imagePosBeforeZoom.x - imagePosAfterZoom.x);
    panY += (imagePosBeforeZoom.y - imagePosAfterZoom.y);
    
    // Clamp panning
    panX = Math.max(0 - imageWidth * 0.1, Math.min(imageWidth * 1.1 - canvas.width / zoomFactor, panX));
    panY = Math.max(0 - imageHeight * 0.1, Math.min(imageHeight * 1.1 - canvas.height / zoomFactor, panY));

    renderImage();
}

// --- Editing Tools ---
function applyBrush(centerX, centerY) {
    if (!imageDataArray) return;
    let modified = false;
    const radius = Math.floor(currentBrushSize / 2);
    const valueToSet = useNaN ? NaN : currentSetValue;

    for (let y = centerY - radius; y <= centerY + radius; y++) {
        for (let x = centerX - radius; x <= centerX + radius; x++) {
            if ((x - centerX) * (x - centerX) + (y - centerY) * (y - centerY) <= radius * radius) {
                if (setPixelValue(x, y, valueToSet, false)) { // Don't record undo for each pixel in a brush stroke
                    modified = true;
                }
            }
        }
    }
    if (modified) {
        // For performance, on drag, might only re-render partially or on mouseup
        // For now, full re-render during drag for simplicity
        if (!isDragging || performance.now() % 50 < 10) { // Throttle render during drag
             updateMinMaxNan(); // This could be slow during drag; optimize later
             updateInfoPanel();
             renderImage();
        }
    }
}

function applyLineBrush(startPos, endPos) {
    // Bresenham's line algorithm (simplified)
    let x0 = startPos.x, y0 = startPos.y;
    const x1 = endPos.x, y1 = endPos.y;
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, e2;

    while (true) {
        applyBrush(x0, y0);
        if (x0 === x1 && y0 === y1) break;
        e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
    }
}


function pickValue(x, y) {
    const val = getPixelValue(x, y);
    if (!Number.isNaN(val)) {
        currentSetValue = val;
        useNaN = false;
    } else {
        // Optional: if picking NaN, set tool to NaN mode
        // useNaN = true;
    }
    updateToolbarControls();
    updateInfoPanel(); // To update current set value display
    statusBar.textContent = `已拾取值: ${Number.isNaN(val) ? 'NaN' : val.toFixed(2)} at (${x}, ${y})`;
}

// --- Zoom and Pan ---
function applyZoom(factor) {
    const newZoomFactor = Math.max(0.05, Math.min(100, zoomFactor * factor)); // zoom limits
    if (Math.abs(newZoomFactor - zoomFactor) < 0.001) return; // No significant change
    zoomFactor = newZoomFactor;
    zoomInput.value = Math.round(zoomFactor * 100);
    statusBar.textContent = `缩放: ${Math.round(zoomFactor * 100)}%`;
    // renderImage(); // Will be called by wheel handler or button click handler
}

function setAbsoluteZoom(absFactor) {
    const newZoomFactor = Math.max(0.05, Math.min(100, absFactor));
    if (Math.abs(newZoomFactor - zoomFactor) < 0.001) return;

    // Try to keep center of view constant
    const viewCenterXCanvas = canvas.width / 2;
    const viewCenterYCanvas = canvas.height / 2;
    const imagePosAtCenterBefore = canvasToImageCoords(viewCenterXCanvas, viewCenterYCanvas);
    
    zoomFactor = newZoomFactor;
    zoomInput.value = Math.round(zoomFactor * 100);

    const imagePosAtCenterAfter = canvasToImageCoords(viewCenterXCanvas, viewCenterYCanvas);

    panX += (imagePosAtCenterBefore.x - imagePosAtCenterAfter.x);
    panY += (imagePosAtCenterBefore.y - imagePosAtCenterAfter.y);
    
    // Clamp panning
    panX = Math.max(0 - imageWidth * 0.1, Math.min(imageWidth * 1.1 - canvas.width / zoomFactor, panX));
    panY = Math.max(0 - imageHeight * 0.1, Math.min(imageHeight * 1.1 - canvas.height / zoomFactor, panY));

    statusBar.textContent = `缩放: ${Math.round(zoomFactor * 100)}%`;
    renderImage();
}

function centerViewOn(imageX, imageY) {
    if (!imageDataArray) return;
    panX = imageX - (canvas.width / zoomFactor) / 2;
    panY = imageY - (canvas.height / zoomFactor) / 2;
    
    // Clamp panning
    panX = Math.max(0 - imageWidth * 0.1, Math.min(imageWidth * 1.1 - canvas.width / zoomFactor, panX));
    panY = Math.max(0 - imageHeight * 0.1, Math.min(imageHeight * 1.1 - canvas.height / zoomFactor, panY));

    renderImage();
    // Optional: Add a temporary marker
    // (draw on top of canvas temporarily, or add an HTML element)
}


// --- Undo/Redo ---
function pushToUndoStack(data) {
    // Create a copy for the stack
    redoStack.length = 0; // Clear redo stack
    undoStack.push(new Float32Array(data));
    if (undoStack.length > MAX_UNDO_STACK_SIZE) {
        undoStack.shift(); // Remove oldest
    }
    updateUndoRedoButtons();
}

function doUndo() {
    if (undoStack.length <= 1) { // <=1 because the last one is current state before change
        statusBar.textContent = "无法撤销";
        return;
    }
    const currentState = undoStack.pop(); // This is the state *before* the one we want to restore
    redoStack.push(currentState);        // So it goes to redo
    
    imageDataArray = new Float32Array(undoStack[undoStack.length -1]); // Restore previous state

    updateAllAfterEdit();
    statusBar.textContent = "已撤销";
    updateUndoRedoButtons();
}

function doRedo() {
    if (redoStack.length === 0) {
        statusBar.textContent = "无法重做";
        return;
    }
    const restoredData = redoStack.pop();
    undoStack.push(restoredData); // This is now the current state
    imageDataArray = new Float32Array(restoredData);
    
    updateAllAfterEdit();
    statusBar.textContent = "已重做";
    updateUndoRedoButtons();
}

function clearUndoRedo() {
    undoStack.length = 0;
    redoStack.length = 0;
    updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
    undoButton.disabled = undoStack.length <= 1; // Can't undo initial state
    redoButton.disabled = redoStack.length === 0;
}


// --- Locate Features ---
function locateAndMark(conditionFn, label) {
    if (!imageDataArray) return;
    let foundX = -1, foundY = -1;
    let bestVal = (label === "最小值" || label.includes("NaN")) ? Infinity : -Infinity;

    for (let y = 0; y < imageHeight; y++) {
        for (let x = 0; x < imageWidth; x++) {
            const val = imageDataArray[y * imageWidth + x];
            if (conditionFn(val, bestVal)) {
                bestVal = val; // For min/max
                if (label.includes("NaN") && Number.isNaN(val)) { // For first NaN, bestVal isn't used to compare
                    foundX = x; foundY = y;
                    break; // Found first NaN
                }
                foundX = x; foundY = y;
            }
        }
        if (label.includes("NaN") && foundX !== -1) break; // Exit outer loop if first NaN found
    }

    if (foundX !== -1) {
        centerViewOn(foundX, foundY);
        const valueText = Number.isNaN(bestVal) ? 'NaN' : bestVal.toFixed(2);
        statusBar.textContent = `${label} 位置: (${foundX}, ${foundY}) | 值: ${valueText}`;
        // TODO: Add a visual marker (e.g., temporary red cross)
        // For now, just centering and status bar.
    } else {
        statusBar.textContent = `未找到 ${label}`;
    }
}

function locateMaxValue() {
    locateAndMark((val, best) => !Number.isNaN(val) && val > best, "最大值");
}
function locateMinValue() {
    locateAndMark((val, best) => !Number.isNaN(val) && val < best, "最小值");
}
function locateFirstNaN() {
    locateAndMark((val) => Number.isNaN(val), "第一个NaN值");
}

// --- NaN Replacement ---
function openReplaceNaNModal() {
    if (!imageDataArray || nanCount === 0) {
        alert("图像中没有NaN值或未加载图像。");
        return;
    }
    nanReplaceTitle.textContent = `替换NaN值 (${nanCount}个)`;
    nanReplaceModal.style.display = "block";
}

function handleReplaceAllNaN() {
    if (!imageDataArray) return;
    pushToUndoStack(imageDataArray);

    const method = document.querySelector('input[name="nanReplaceMethod"]:checked').value;
    let replacementValue;
    let success = false;

    try {
        if (method === "constant") {
            replacementValue = parseFloat(replaceNanConstantValueInput.value);
            if (Number.isNaN(replacementValue)) throw new Error("无效的替换值");
        } else if (method === "statistic") {
            const statType = replaceNanStatisticTypeSelect.value;
            let validValues = [];
            for (let i = 0; i < imageDataArray.length; i++) {
                if (!Number.isNaN(imageDataArray[i])) validValues.push(imageDataArray[i]);
            }
            if (validValues.length === 0) throw new Error("没有有效的非NaN值可用于统计。");

            if (statType === "mean") {
                replacementValue = validValues.reduce((a, b) => a + b, 0) / validValues.length;
            } else if (statType === "median") {
                validValues.sort((a, b) => a - b);
                const mid = Math.floor(validValues.length / 2);
                replacementValue = validValues.length % 2 !== 0 ? validValues[mid] : (validValues[mid - 1] + validValues[mid]) / 2;
            } else if (statType === "min") {
                replacementValue = Math.min(...validValues);
            } else if (statType === "max") {
                replacementValue = Math.max(...validValues);
            }
        } else if (method === "interpolate") { // Very simple nearest neighbor for demonstration
            // This is a placeholder for a more complex interpolation.
            // A true interpolation (linear/cubic) is much harder in JS without libraries.
            // This simple "nearest non-NaN" could be very slow for large images / many NaNs.
            // For now, let's just fill with mean as a placeholder for interpolate.
            statusBar.textContent = "插值替换（简化为平均值）...";
            let validValues = [];
            for (let i = 0; i < imageDataArray.length; i++) {
                if (!Number.isNaN(imageDataArray[i])) validValues.push(imageDataArray[i]);
            }
            if (validValues.length === 0) throw new Error("没有有效的非NaN值可用于统计。");
            replacementValue = validValues.reduce((a, b) => a + b, 0) / validValues.length;
        }

        for (let i = 0; i < imageDataArray.length; i++) {
            if (Number.isNaN(imageDataArray[i])) {
                imageDataArray[i] = replacementValue;
            }
        }
        success = true;
    } catch (error) {
        alert("替换NaN值出错: " + error.message);
        // Rollback if pushToUndoStack was called and error occurs before modification
        // (This is tricky; robust undo might need more thought for partial failures)
    }

    if (success) {
        updateAllAfterEdit();
        statusBar.textContent = `已替换 ${nanCount} 个NaN值。`;
    }
    nanReplaceModal.style.display = "none";
}


// --- Helper for common updates ---
function updateAllAfterEdit() {
    updateMinMaxNan();
    updateInfoPanel();
    renderImage();
}


// --- Start the app ---
initialize();