'use client';

import { useState } from 'react';
import { reviewerAssignmentsApi, ImportResult } from '@/lib/reviewer-assignments';

interface BulkUploadModalProps {
  reviewCycleId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BulkUploadModal({
  reviewCycleId,
  onClose,
  onSuccess,
}: BulkUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const parseCSV = (text: string) => {
    const lines = text.split('\n').filter((line) => line.trim());
    const assignments = [];

    for (let i = 1; i < lines.length; i++) {
      const [employeeEmail, reviewerEmail, reviewerType] = lines[i]
        .split(',')
        .map((s) => s.trim());

      if (employeeEmail && reviewerEmail && reviewerType) {
        assignments.push({
          employeeEmail,
          reviewerEmail,
          reviewerType: reviewerType.toUpperCase() as 'MANAGER' | 'PEER',
        });
      }
    }

    return assignments;
  };

  const handleUpload = async () => {
    if (!file) return;

    try {
      setUploading(true);

      const text = await file.text();
      const assignments = parseCSV(text);

      const result = await reviewerAssignmentsApi.importAssignments(
        reviewCycleId,
        assignments,
      );

      setResult(result);

      if (result.failed === 0) {
        setTimeout(() => {
          onSuccess();
        }, 2000);
      }
    } catch (err: any) {
      setResult({
        successful: 0,
        failed: 1,
        errors: [err.message || 'Upload failed'],
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed z-10 inset-0 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 bg-on-surface/50 transition-opacity"
          onClick={onClose}
        />

        <div className="inline-block align-bottom bg-surface-container-lowest rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <div className="bg-surface-container-lowest px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <h3 className="text-lg leading-6 font-medium text-on-surface mb-4">
              Bulk Upload Reviewer Assignments
            </h3>

            {/* Instructions */}
            <div className="mb-4 p-4 bg-blue-50 rounded-md">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">
                CSV Format
              </h4>
              <pre className="text-xs text-blue-800 font-mono whitespace-pre-wrap">
                {`employee_email,reviewer_email,reviewer_type
john@company.com,jane@company.com,MANAGER
john@company.com,bob@company.com,PEER
john@company.com,alice@company.com,PEER
john@company.com,charlie@company.com,PEER`}
              </pre>
              <p className="mt-2 text-xs text-blue-800">
                • First row is the header (required)
                <br />
                • reviewer_type must be MANAGER or PEER
                <br />
                • Each employee needs 1+ managers and 1+ peers
                <br />• All emails must exist in your company
              </p>
            </div>

            {/* File Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-on-surface-variant mb-2">
                Upload CSV File
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="block w-full text-sm text-on-surface-variant file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
            </div>

            {/* Results */}
            {result && (
              <div
                className={`mb-4 p-4 rounded-md ${
                  result.failed === 0
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-yellow-50 border border-yellow-200'
                }`}
              >
                <h4 className="text-sm font-semibold mb-2">Upload Results</h4>
                <p className="text-sm">
                  ✅ Successful: {result.successful} | ❌ Failed: {result.failed}
                </p>
                {result.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-semibold">Errors:</p>
                    <ul className="list-disc list-inside text-xs mt-1 max-h-40 overflow-y-auto">
                      {result.errors.slice(0, 20).map((error, i) => (
                        <li key={i}>{error}</li>
                      ))}
                      {result.errors.length > 20 && (
                        <li className="font-semibold">
                          ... and {result.errors.length - 20} more errors
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-surface-container-low px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary text-base font-medium text-white hover:bg-primary-dim focus:outline-none sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
            <button
              onClick={onClose}
              disabled={uploading}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-outline shadow-sm px-4 py-2 bg-surface-container-lowest text-base font-medium text-on-surface-variant hover:bg-surface-container-low focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
