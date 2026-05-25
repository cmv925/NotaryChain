import React, { useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from './ui/button';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, X, FileText, Maximize2 } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export function PDFPreview({ fileUrl, fileName, onClose }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const onDocumentLoadSuccess = useCallback(({ numPages }) => {
    setNumPages(numPages);
    setLoading(false);
  }, []);

  const onDocumentLoadError = useCallback((err) => {
    setError('Failed to load PDF');
    setLoading(false);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col" data-testid="pdf-preview-modal">
      {/* Toolbar */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-coral-500" />
          <span className="text-white font-medium text-sm truncate max-w-[300px]">{fileName || 'Document'}</span>
          {numPages && (
            <span className="text-slate-500 text-sm">
              Page {pageNumber} of {numPages}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Page Navigation */}
          <Button
            variant="ghost" size="sm"
            onClick={() => setPageNumber(p => Math.max(1, p - 1))}
            disabled={pageNumber <= 1}
            className="text-slate-500 hover:text-white h-8 w-8 p-0"
            data-testid="pdf-prev-page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost" size="sm"
            onClick={() => setPageNumber(p => Math.min(numPages || 1, p + 1))}
            disabled={pageNumber >= (numPages || 1)}
            className="text-slate-500 hover:text-white h-8 w-8 p-0"
            data-testid="pdf-next-page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <div className="w-px h-5 bg-slate-200 mx-1" />

          {/* Zoom */}
          <Button
            variant="ghost" size="sm"
            onClick={() => setScale(s => Math.max(0.5, s - 0.25))}
            className="text-slate-500 hover:text-white h-8 w-8 p-0"
            data-testid="pdf-zoom-out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-slate-500 text-xs w-12 text-center">{Math.round(scale * 100)}%</span>
          <Button
            variant="ghost" size="sm"
            onClick={() => setScale(s => Math.min(3, s + 0.25))}
            className="text-slate-500 hover:text-white h-8 w-8 p-0"
            data-testid="pdf-zoom-in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>

          <div className="w-px h-5 bg-slate-200 mx-1" />

          {/* Download */}
          {fileUrl && (
            <a href={fileUrl} download={fileName} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="text-slate-500 hover:text-white h-8 w-8 p-0" data-testid="pdf-download">
                <Download className="h-4 w-4" />
              </Button>
            </a>
          )}

          {/* Close */}
          <Button
            variant="ghost" size="sm"
            onClick={onClose}
            className="text-slate-500 hover:text-white h-8 w-8 p-0"
            data-testid="pdf-close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Document Area */}
      <div className="flex-1 overflow-auto flex items-start justify-center p-4">
        {error ? (
          <div className="text-center text-slate-500 mt-20">
            <FileText className="h-16 w-16 mx-auto mb-4 opacity-40" />
            <p>{error}</p>
          </div>
        ) : (
          <Document
            file={fileUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="text-center text-slate-500 mt-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-coral-300 mx-auto mb-4" />
                <p>Loading document...</p>
              </div>
            }
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              className="shadow-2xl"
              renderTextLayer={true}
              renderAnnotationLayer={true}
            />
          </Document>
        )}
      </div>
    </div>
  );
}

export function PDFPreviewButton({ fileUrl, fileName, className = '' }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!fileUrl) return null;

  const isPDF = fileName?.toLowerCase().endsWith('.pdf') || fileUrl?.toLowerCase().includes('.pdf');
  if (!isPDF) return null;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className={`border-coral-300/50 text-coral-500 hover:bg-coral-500/10 ${className}`}
        data-testid="pdf-preview-button"
      >
        <Maximize2 className="h-3 w-3 mr-1" />
        Preview
      </Button>
      {isOpen && (
        <PDFPreview fileUrl={fileUrl} fileName={fileName} onClose={() => setIsOpen(false)} />
      )}
    </>
  );
}
