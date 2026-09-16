import sys

def main():
    print("Downloading EasyOCR models...")
    try:
        import easyocr
        # Initializing the reader automatically downloads the models if they don't exist
        reader = easyocr.Reader(['en'], gpu=False, verbose=True)
        print("Models downloaded and verified successfully.")
    except Exception as e:
        print(f"Failed to download models: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
