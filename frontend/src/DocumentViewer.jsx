import React, { useState, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { ZoomIn } from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export default function DocumentViewer({
  file,
  clauses,
  flags,
  activeClauseId,
  onClauseClick,
  chatClauseId,
  onBoxesReady,
}) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const containerRef = useRef(null);
  const [boxes, setBoxes] = useState({});
  const isImage = file && file.type && file.type.startsWith("image/");

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
  }

  // Effect to find text coordinates in the DOM after render
  useEffect(() => {
    const findTextBounds = () => {
      const newBoxes = {};

      if (isImage) {
        const img = containerRef.current.querySelector("img");
        if (!img || img.clientHeight === 0) {
          // If image isn't loaded yet, try again
          setTimeout(findTextBounds, 500);
          return;
        }
        const rect = img.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();

        const marginY = rect.height * 0.12; // 12% vertical margin
        const marginX = rect.width * 0.1; // 10% horizontal margin
        const usableHeight = rect.height - marginY * 2;
        const usableWidth = rect.width - marginX * 2;

        const totalChars = clauses.reduce((sum, c) => sum + c.text.length, 0);
        let currentTopOffset = 0;

        clauses.forEach((clause) => {
          const charRatio = clause.text.length / totalChars;
          const boxHeight = usableHeight * charRatio;

          newBoxes[clause.id] = {
            top:
              rect.top -
              containerRect.top +
              containerRef.current.scrollTop +
              marginY +
              currentTopOffset,
            left: rect.left - containerRect.left + marginX,
            width: usableWidth,
            height: Math.max(20, boxHeight - 8), // min height 20px, small gap
            absTop: rect.top + marginY + currentTopOffset,
            absLeft: rect.left + marginX,
          };
          currentTopOffset += boxHeight;
        });
      } else {
        const textLayers = document.querySelectorAll(
          ".react-pdf__Page__textContent",
        );
        if (textLayers.length === 0) return;

        clauses.forEach((clause) => {
          // Simple search heuristic
          const firstWords = clause.text.split(" ").slice(0, 5).join(" ");

          let foundSpan = null;
          const spans = document.querySelectorAll(
            ".react-pdf__Page__textContent span",
          );
          for (let span of spans) {
            if (
              span.textContent.includes(firstWords) ||
              firstWords.includes(span.textContent)
            ) {
              foundSpan = span;
              break;
            }
          }

          if (foundSpan) {
            const rect = foundSpan.getBoundingClientRect();
            const containerRect = containerRef.current.getBoundingClientRect();
            newBoxes[clause.id] = {
              top:
                rect.top - containerRect.top + containerRef.current.scrollTop,
              left: rect.left - containerRect.left,
              width:
                containerRect.width - (rect.left - containerRect.left) - 40,
              height: 60,
              absTop: rect.top,
              absLeft: rect.left,
            };
          }
        });
      }

      setBoxes(newBoxes);
      if (onBoxesReady) onBoxesReady(newBoxes);
    };

    const timeout = setTimeout(findTextBounds, 1500); // wait for text layer/image to fully render
    return () => clearTimeout(timeout);
  }, [clauses, file, pageNumber, isImage, onBoxesReady]);

  // Handle chat auto-scroll
  useEffect(() => {
    if (chatClauseId && boxes[chatClauseId] && containerRef.current) {
      containerRef.current.scrollTo({
        top: boxes[chatClauseId].top - 50,
        behavior: "smooth",
      });
    }
  }, [chatClauseId, boxes]);

  return (
    <div
      className="relative w-full h-[85vh] overflow-auto scrollbar-hide bg-[#0a0a0c]/80 backdrop-blur-3xl rounded-3xl border border-white/5 shadow-2xl shadow-indigo-900/10"
      ref={containerRef}
    >
      <div className="sticky top-0 left-0 bg-[#0a0a0c]/90 backdrop-blur-xl py-4 px-6 z-10 flex justify-between border-b border-white/5 shadow-sm">
        <h3 className="font-semibold text-white/90 flex items-center gap-2.5 tracking-tight text-lg">
          <ZoomIn className="w-5 h-5 text-indigo-400" />
          Interactive Visual X-Ray
        </h3>
        {numPages && (
          <div className="flex gap-3 items-center">
            <button
              onClick={() => setPageNumber(Math.max(1, pageNumber - 1))}
              aria-label="Previous Page"
              className="text-xs bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors font-medium"
            >
              Prev
            </button>
            <span className="text-xs font-medium text-white/70">
              Page {pageNumber} of {numPages}
            </span>
            <button
              onClick={() => setPageNumber(Math.min(numPages, pageNumber + 1))}
              aria-label="Next Page"
              className="text-xs bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors font-medium"
            >
              Next
            </button>
          </div>
        )}
      </div>

      <div className="relative inline-block mx-auto min-w-full p-4">
        {isImage ? (
          <img
            src={URL.createObjectURL(file)}
            alt="Document"
            className="w-full max-w-2xl mx-auto"
          />
        ) : file ? (
          <Document
            file={file}
            onLoadSuccess={onDocumentLoadSuccess}
            className="flex flex-col items-center"
          >
            <Page pageNumber={pageNumber} width={600} />
          </Document>
        ) : (
          <div className="text-neutral-500 p-10 text-center">
            No visual preview available.
          </div>
        )}

        {/* Heatmap Overlays */}
        {Object.entries(boxes).map(([id, box]) => {
          const analysis = flags[id];

          let colorClass =
            "border-dashed border-white/10 hover:border-indigo-400/50 hover:bg-indigo-500/5 transition-all duration-300"; // unanalyzed
          if (analysis) {
            if (analysis.risk_level === "High")
              colorClass =
                "bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-pulse";
            else if (analysis.risk_level === "Medium")
              colorClass =
                "bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.2)]";
            else
              colorClass =
                "bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/30";
          }

          return (
            <div
              key={`box-${id}`}
              className={`absolute border-2 rounded cursor-pointer transition-all ${colorClass} ${activeClauseId === id ? "ring-4 ring-indigo-500" : ""} ${chatClauseId === id ? "ring-4 ring-purple-500 animate-bounce" : ""}`}
              style={{
                top: box.top,
                left: box.left,
                width: box.width,
                height: box.height,
              }}
              onClick={() => onClauseClick(clauses.find((c) => c.id === id))}
            />
          );
        })}
      </div>
    </div>
  );
}
