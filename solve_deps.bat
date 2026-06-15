@echo off
echo Starting installation with legacy peer deps...
npm install @tensorflow/tfjs @tensorflow/tfjs-react-native @tensorflow-models/coco-ssd expo-gl jpeg-js buffer --legacy-peer-deps
if %ERRORLEVEL% NEQ 0 (
    echo Installation failed!
    exit /b %ERRORLEVEL%
)
echo Installation successful.
