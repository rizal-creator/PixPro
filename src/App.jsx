import React, { useState, useRef, useEffect } from 'react';
import './App.css';

function ImageEditor() {
  const [image, setImage] = useState(null);
  const [originalImage, setOriginalImage] = useState(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const [config, setConfig] = useState({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    blur: 0,
    resolution: 'HD',
    format: 'PNG',
    quality: 0.9
  });

  const [imageInfo, setImageInfo] = useState({
    originalSize: null,
    processedSize: null,
    fileType: null
  });

  const loadImage = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setOriginalImage(img);
        setImage(img);
        setImageInfo({
          originalSize: `${img.width} x ${img.height}`,
          fileType: file.type,
          processedSize: null
        });
        processImage(img);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  const processImage = (img) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const resolutions = {
      'SD': { width: 640, height: 480 },
      'HD': { width: 1280, height: 720 },
      'FULL HD': { width: 1920, height: 1080 }
    };

    const currentResolution = resolutions[config.resolution];
    canvas.width = currentResolution.width;
    canvas.height = currentResolution.height;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.filter = `
      brightness(${config.brightness}%) 
      contrast(${config.contrast}%) 
      saturate(${config.saturation}%) 
      blur(${config.blur}px)
    `;

    ctx.drawImage(img, 0, 0, currentResolution.width, currentResolution.height);

    setImageInfo(prev => ({
      ...prev,
      processedSize: `${currentResolution.width} x ${currentResolution.height}`
    }));
  };

  useEffect(() => {
    if (image) {
      processImage(image);
    }
  }, [config, image]);

  const updateConfig = (key, value) => {
    setConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const saveImage = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    const fileName = `edited_image_${config.resolution}.${config.format.toLowerCase()}`;
    const dataUrl = canvas.toDataURL(`image/${config.format.toLowerCase()}`, config.quality);
    link.download = fileName;
    link.href = dataUrl;
    link.click();
  };

  const resetImage = () => {
    if (originalImage) {
      setImage(originalImage);
      setConfig({
        brightness: 100,
        contrast: 100,
        saturation: 100,
        blur: 0,
        resolution: 'HD',
        format: 'PNG',
        quality: 0.9
      });
    }
  };
  const applyEdgeDetection = (img) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
  
    const sobelX = [
      [-1, 0, 1],
      [-2, 0, 2],
      [-1, 0, 1]
    ];
    const sobelY = [
      [-1, -2, -1],
      [0, 0, 0],
      [1, 2, 1]
    ];
  
    const width = canvas.width;
    const height = canvas.height;
    const edgeData = new Uint8ClampedArray(data);
  
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let pixelX = 0;
        let pixelY = 0;
  
        for (let j = -1; j <= 1; j++) {
          for (let i = -1; i <= 1; i++) {
            const idx = ((y + j) * width + (x + i)) * 4;
            const gray = data[idx] * 0.3 + data[idx + 1] * 0.59 + data[idx + 2] * 0.11;
  
            pixelX += sobelX[j + 1][i + 1] * gray;
            pixelY += sobelY[j + 1][i + 1] * gray;
          }
        }
  
        const magnitude = Math.sqrt(pixelX ** 2 + pixelY ** 2);
        const idx = (y * width + x) * 4;
        edgeData[idx] = magnitude;
        edgeData[idx + 1] = magnitude;
        edgeData[idx + 2] = magnitude;
        edgeData[idx + 3] = 255; // Keep alpha channel
      }
    }
  
    ctx.putImageData(new ImageData(edgeData, width, height), 0, 0);
  };

  const applyHistogramEqualization = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
  
    const histogram = new Array(256).fill(0);
    const cdf = new Array(256).fill(0);
  
    // Calculate histogram
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11);
      histogram[gray]++;
    }
  
    // Calculate cumulative distribution function (CDF)
    cdf[0] = histogram[0];
    for (let i = 1; i < 256; i++) {
      cdf[i] = cdf[i - 1] + histogram[i];
    }
  
    // Normalize CDF
    const cdfMin = cdf.find(value => value > 0);
    const totalPixels = canvas.width * canvas.height;
    const cdfNormalized = cdf.map(value => Math.round((value - cdfMin) / (totalPixels - cdfMin) * 255));
  
    // Apply equalization
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11);
      const newGray = cdfNormalized[gray];
      data[i] = data[i + 1] = data[i + 2] = newGray;
    }
  
    ctx.putImageData(imageData, 0, 0);
  };

  const applyCustomFilter = (kernel) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;
  
    const result = new Uint8ClampedArray(data);
  
    const offset = Math.floor(kernel.length / 2);
  
    for (let y = offset; y < height - offset; y++) {
      for (let x = offset; x < width - offset; x++) {
        let r = 0, g = 0, b = 0;
  
        for (let j = -offset; j <= offset; j++) {
          for (let i = -offset; i <= offset; i++) {
            const idx = ((y + j) * width + (x + i)) * 4;
            const weight = kernel[j + offset][i + offset];
  
            r += data[idx] * weight;
            g += data[idx + 1] * weight;
            b += data[idx + 2] * weight;
          }
        }
  
        const idx = (y * width + x) * 4;
        result[idx] = Math.min(255, Math.max(0, r));
        result[idx + 1] = Math.min(255, Math.max(0, g));
        result[idx + 2] = Math.min(255, Math.max(0, b));
        result[idx + 3] = 255; // Keep alpha channel
      }
    }
  
    ctx.putImageData(new ImageData(result, width, height), 0, 0);
  };
  
  

  return (
    <div className="container">
      <h1>Professional Image Editor</h1>
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={loadImage}
        className="file-input"
      />

      {image && (
        <div className="editor-container">
          <div className="controls">
            <div className="control">
              <label>Brightness</label>
              <input
                type="range"
                min="0"
                max="200"
                value={config.brightness}
                onChange={(e) => updateConfig('brightness', e.target.value)}
              />
              <span>{config.brightness}%</span>
            </div>

            <div className="control">
              <label>Contrast</label>
              <input
                type="range"
                min="0"
                max="200"
                value={config.contrast}
                onChange={(e) => updateConfig('contrast', e.target.value)}
              />
              <span>{config.contrast}%</span>
            </div>

            <div className="control">
              <label>Color Saturation</label>
              <input
                type="range"
                min="0"
                max="200"
                value={config.saturation}
                onChange={(e) => updateConfig('saturation', e.target.value)}
              />
              <span>{config.saturation}%</span>
            </div>

            <div className="control">
              <label>Blur</label>
              <input
                type="range"
                min="0"
                max="10"
                step="0.1"
                value={config.blur}
                onChange={(e) => updateConfig('blur', e.target.value)}
              />
              <span>{config.blur}px</span>
            </div>
            <div className='edge'>
            <button onClick={() => applyEdgeDetection(image)}>Edge Detection</button>
            </div>

            <div className='histogram'>
            <button onClick={applyHistogramEqualization}>Histogram Equalization</button>
            </div>

            <div className='customfilter'>
            <button onClick={() => applyCustomFilter([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])}>Sharpen</button>
            <button onClick={() => applyCustomFilter([[1, 1, 1], [1, -7, 1], [1, 1, 1]])}>Emboss</button>

            </div>

            <div className="control">
              <label>Image Resolution</label>
              <select
                value={config.resolution}
                onChange={(e) => updateConfig('resolution', e.target.value)}
              >
                <option value="SD">SD (640x480)</option>
                <option value="HD">HD (1280x720)</option>
                <option value="FULL HD">Full HD (1920x1080)</option>
              </select>
            </div>

            <div className="control">
              <label>Image Format</label>
              <select
                value={config.format}
                onChange={(e) => updateConfig('format', e.target.value)}
              >
                <option value="PNG">PNG</option>
                <option value="JPEG">JPEG</option>
                <option value="WEBP">WebP</option>
              </select>
            </div>

            <div className="control">
              <label>Compression Quality</label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={config.quality}
                onChange={(e) => updateConfig('quality', e.target.value)}
              />
              <span>{(config.quality * 100).toFixed(0)}%</span>
            </div>
          </div>

          <div className="preview-section">
            <canvas
              ref={canvasRef}
              className="preview"
            />

            <div className="image-info">
              <p>Original Resolution: {imageInfo.originalSize}</p>
              <p>Processed Resolution: {imageInfo.processedSize}</p>
              <p>File Type: {imageInfo.fileType}</p>
            </div>

            <div className="actions">
              <button onClick={saveImage} className="save-button">
                Save Image
              </button>
              <button onClick={resetImage} className="reset-button">
                Reset Image
              </button>
            </div>
           
          </div>
        </div>
      )}
    </div>
  );
}

export default ImageEditor;