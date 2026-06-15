import cv2
import sys
import os

img_path = '../assets/icon.png'
if not os.path.exists(img_path):
    print("Error: Icon not found")
    sys.exit(1)

img = cv2.imread(img_path)
if img is None:
    print("Error: Could not read image")
    sys.exit(1)

h, w = img.shape[:2]
sq = min(h, w)
start_y = (h - sq) // 2
start_x = (w - sq) // 2
cropped = img[start_y:start_y+sq, start_x:start_x+sq]
resized = cv2.resize(cropped, (1024, 1024))
cv2.imwrite(img_path, resized)
print("SUCCESS: Image cropped to 1024x1024")
