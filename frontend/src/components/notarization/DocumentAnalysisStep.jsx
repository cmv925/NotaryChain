import React from 'react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Card, CardContent } from '../ui/card';
import { FileText, Upload, Eye, Loader2, Maximize2 } from 'lucide-react';
import { AnalysisResults } from './AnalysisResults';

const DOCUMENT_TYPES = [
  { value: 'general', label: 'General Document' },
  { value: 'power_of_attorney', label: 'Power of Attorney' },
  { value: 'real_estate', label: 'Real Estate Document' },
  { value: 'affidavit', label: 'Affidavit' },
  { value: 'will', label: 'Last Will & Testament' },
  { value: 'trust', label: 'Trust Document' },
  { value: 'contract', label: 'Contract' },
];

export const DocumentAnalysisStep = ({
  formData,
  selectedFile,
  uploading,
  analysisResult,
  canProceedToStep2,
  onFileSelect,
  onRemoveFile,
  onDocTypeChange,
  onAnalyze,
  onShowPdfPreview,
  onProceedToStep2,
}) => (
  <Card className="bg-gradient-to-br from-[#1a2332] to-[#0f1825] border border-gray-800" data-testid="step-1-card">
    <CardContent className="p-8">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
        <FileText className="w-6 h-6 text-blue-500" />
        Step 1: Document Analysis
      </h2>

      {/* Document Type Selection */}
      <div className="mb-6">
        <Label htmlFor="document_type" className="text-white mb-2 block">
          Document Type
        </Label>
        <select
          id="document_type"
          name="document_type"
          value={formData.document_type}
          onChange={onDocTypeChange}
          className="w-full bg-[#0a0f1a] border border-gray-700 rounded-md px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
          data-testid="document-type-select"
        >
          {DOCUMENT_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      {/* File Upload Area */}
      <div className="mb-6">
        <Label className="text-white mb-2 block">Upload Document</Label>
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            selectedFile ? 'border-blue-500 bg-blue-500/5' : 'border-gray-700 hover:border-gray-600'
          }`}
        >
          {selectedFile ? (
            <div className="space-y-3">
              <FileText className="w-12 h-12 mx-auto text-blue-500" />
              <p className="text-white font-medium">{selectedFile.name}</p>
              <p className="text-gray-400 text-sm">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
              <div className="flex items-center justify-center gap-2">
                {selectedFile.type === 'application/pdf' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onShowPdfPreview}
                    className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                    data-testid="preview-pdf-btn"
                  >
                    <Maximize2 className="w-4 h-4 mr-1" />
                    Preview
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRemoveFile}
                  className="border-gray-600 text-gray-300"
                >
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <label className="cursor-pointer block">
              <Upload className="w-12 h-12 mx-auto text-gray-500 mb-4" />
              <p className="text-gray-300 mb-2">
                Drag and drop or click to upload
              </p>
              <p className="text-gray-500 text-sm">
                Supports PDF, JPG, PNG, TXT (Max 10MB)
              </p>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.txt"
                onChange={onFileSelect}
                className="hidden"
                data-testid="file-input"
              />
            </label>
          )}
        </div>
      </div>

      {/* Analyze Button */}
      {selectedFile && !analysisResult && (
        <Button
          onClick={onAnalyze}
          disabled={uploading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4"
          data-testid="analyze-btn"
        >
          {uploading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Analyzing Document with AI...
            </>
          ) : (
            <>
              <Eye className="w-5 h-5 mr-2" />
              Analyze Document
            </>
          )}
        </Button>
      )}

      {/* Analysis Results */}
      {analysisResult && (
        <AnalysisResults
          analysisResult={analysisResult}
          canProceedToStep2={canProceedToStep2}
          onProceed={onProceedToStep2}
        />
      )}
    </CardContent>
  </Card>
);
