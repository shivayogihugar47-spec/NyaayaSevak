import sys
import os
import io

# We need to make sure stdout can handle utf-8
sys.stdout.reconfigure(encoding='utf-8')

def main():
    if len(sys.argv) < 3:
        print("Usage: python_ocr.py <file_path> <mimetype>")
        sys.exit(1)

    file_path = sys.argv[1]
    mimetype = sys.argv[2]

    # Initialize EasyOCR
    # Note: the models should be downloaded in advance during setup
    try:
        import easyocr
        reader = easyocr.Reader(['en'], gpu=False, verbose=False)
    except Exception as e:
        print(f"ERROR_INIT: Failed to initialize EasyOCR: {e}", file=sys.stderr)
        sys.exit(2)

    extracted_text = []

    try:
        if mimetype == 'application/pdf':
            import fitz # PyMuPDF
            doc = fitz.open(file_path)
            
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                # Render page to an image (pixmap)
                # zoom factor 2 for better OCR resolution
                matrix = fitz.Matrix(2.0, 2.0)
                pix = page.get_pixmap(matrix=matrix)
                
                # Convert pixmap to bytes, then to image array for easyocr
                img_bytes = pix.tobytes("png")
                
                # Run OCR on the image bytes
                results = reader.readtext(img_bytes, detail=0)
                extracted_text.extend(results)
                
            doc.close()
            
        elif mimetype.startswith('image/'):
            results = reader.readtext(file_path, detail=0)
            extracted_text.extend(results)
        else:
            print(f"ERROR_UNSUPPORTED: Unsupported mimetype for OCR: {mimetype}", file=sys.stderr)
            sys.exit(3)
            
        # Output the joined text
        final_text = "\n".join(extracted_text)
        print(final_text)
        
    except Exception as e:
        print(f"ERROR_PROC: Failed to process document: {e}", file=sys.stderr)
        sys.exit(4)

if __name__ == '__main__':
    main()
