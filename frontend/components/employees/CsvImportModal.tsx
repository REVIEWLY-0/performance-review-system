'use client';

import { useState, useRef } from 'react';
import { usersApi } from '@/lib/api';
import { useToast } from '@/components/ToastProvider';

interface CsvImportModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedRow {
  name: string;
  email: string;
  role: string;
  department: string;
  managerEmail?: string;
  employeeId?: string;
  /** Row number in the CSV (1-based, excluding header) */
  rowNum: number;
  /** Validation warning shown in preview */
  warning?: string;
}

interface ImportResult {
  successful: number;
  failed: number;
  errors: string[];
}

type Step = 'upload' | 'preview' | 'result';

// ── CSV parser ────────────────────────────────────────────────────────────────
function parseCSV(text: string): ParsedRow[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  return lines.slice(1).map((line, idx) => {
    // Naive CSV split (no quoted-field support needed for this schema)
    const [name = '', email = '', role = '', department = '', managerEmail = '', employeeId = ''] = line
      .split(',')
      .map((s) => s.trim());

    const row: ParsedRow = {
      name,
      email,
      role: role.toUpperCase() || 'EMPLOYEE',
      department,
      managerEmail: managerEmail || undefined,
      employeeId: employeeId || undefined,
      rowNum: idx + 2, // +2 because header is row 1
    };

    if (!name) row.warning = 'Missing name';
    else if (!email) row.warning = 'Missing email';
    else if (!department) row.warning = 'Missing department (required)';
    else if (!['ADMIN', 'MANAGER', 'EMPLOYEE'].includes(row.role)) {
      row.warning = `Unknown role "${role}"`;
    }

    return row;
  });
}

const PREVIEW_LIMIT = 8;

export default function CsvImportModal({ onClose, onSuccess }: CsvImportModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const text = await f.text();
    const parsed = parseCSV(text);
    setRows(parsed);
    if (parsed.length > 0) setStep('preview');
  };

  const validRows = rows.filter((r) => !r.warning);
  const warnRows = rows.filter((r) => r.warning);

  const handleImport = async () => {
    setImporting(true);
    try {
      const payload = validRows.map(({ name, email, role, department, managerEmail, employeeId }) => ({
        name,
        email,
        role,
        department,
        ...(managerEmail ? { managerEmail } : {}),
        ...(employeeId ? { employeeId } : {}),
      }));
      const res = await usersApi.importUsers(payload);
      setResult(res);
      setStep('result');
    } catch (err: any) {
      setResult({ successful: 0, failed: validRows.length, errors: [err.message || 'Import failed'] });
      setStep('result');
    } finally {
      setImporting(false);
    }
  };

  const handleDone = () => {
    if (result && result.successful > 0) {
      toast.success(`${result.successful} employee${result.successful !== 1 ? 's' : ''} imported successfully`);
      onSuccess();
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed z-10 inset-0 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={step !== 'result' ? onClose : undefined}
        />

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">

          {/* ── Header ── */}
          <div className="bg-white px-6 pt-5 pb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Import Employees from CSV
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* ── Step: upload ── */}
            {step === 'upload' && (
              <>
                {/* Format guide */}
                <div className="mb-4 p-4 bg-blue-50 rounded-md">
                  <h4 className="text-sm font-semibold text-blue-900 mb-1">CSV Format</h4>
                  <pre className="text-xs text-blue-800 font-mono whitespace-pre-wrap leading-relaxed">
{`name,email,role,department,manager_email,employee_id
Alice Smith,alice@company.com,EMPLOYEE,Engineering,bob@company.com,EMP-001
Bob Jones,bob@company.com,MANAGER,Engineering,,
Carol White,carol@company.com,ADMIN,Operations,,`}
                  </pre>
                  <ul className="mt-2 text-xs text-blue-800 space-y-0.5">
                    <li>• First row is the header (required)</li>
                    <li>• <strong>role</strong> must be: <code>EMPLOYEE</code>, <code>MANAGER</code>, or <code>ADMIN</code></li>
                    <li>• <strong>department</strong> is <strong>required</strong> — e.g. Engineering, Sales, Marketing</li>
                    <li>• <strong>manager_email</strong> is optional — leave blank for top-level managers</li>
                    <li>• <strong>employee_id</strong> is optional — leave blank to auto-generate (e.g. EMP-XK4J9R)</li>
                    <li>• All emails must be unique within your company</li>
                  </ul>
                </div>

                {/* File picker */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Choose CSV file
                  </label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0
                      file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700
                      hover:file:bg-indigo-100 cursor-pointer"
                  />
                </div>
              </>
            )}

            {/* ── Step: preview ── */}
            {step === 'preview' && (
              <>
                {/* Summary bar */}
                <div className="flex items-center space-x-4 mb-3">
                  <span className="text-sm text-gray-600">
                    <span className="font-semibold text-gray-900">{rows.length}</span> rows parsed from{' '}
                    <span className="font-medium">{file?.name}</span>
                  </span>
                  {warnRows.length > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                      {warnRows.length} row{warnRows.length !== 1 ? 's' : ''} with warnings (will be skipped)
                    </span>
                  )}
                </div>

                {/* Preview table */}
                <div className="border border-gray-200 rounded-md overflow-hidden mb-3">
                  <table className="min-w-full text-xs divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600 w-6">#</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Name</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Email</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Role</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Department</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Manager email</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {rows.slice(0, PREVIEW_LIMIT).map((row) => (
                        <tr
                          key={row.rowNum}
                          className={row.warning ? 'bg-yellow-50' : ''}
                        >
                          <td className="px-3 py-1.5 text-gray-400">{row.rowNum}</td>
                          <td className="px-3 py-1.5 text-gray-900 font-medium">
                            {row.name || <span className="text-red-500 italic">missing</span>}
                          </td>
                          <td className="px-3 py-1.5 text-gray-600">
                            {row.email || <span className="text-red-500 italic">missing</span>}
                          </td>
                          <td className="px-3 py-1.5">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium
                              ${row.role === 'ADMIN' ? 'bg-purple-100 text-purple-800'
                                : row.role === 'MANAGER' ? 'bg-blue-100 text-blue-800'
                                : 'bg-green-100 text-green-800'}`}>
                              {row.role}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-gray-700">
                            {row.department || <span className="text-red-400 italic">missing</span>}
                          </td>
                          <td className="px-3 py-1.5 text-gray-500">
                            {row.managerEmail || <span className="text-gray-300">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {rows.length > PREVIEW_LIMIT && (
                    <div className="px-3 py-2 bg-gray-50 text-xs text-gray-500 border-t border-gray-200">
                      + {rows.length - PREVIEW_LIMIT} more rows not shown
                    </div>
                  )}
                </div>

                {/* Warning rows detail */}
                {warnRows.length > 0 && (
                  <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-xs font-semibold text-yellow-800 mb-1">Rows that will be skipped:</p>
                    <ul className="text-xs text-yellow-700 space-y-0.5">
                      {warnRows.map((r) => (
                        <li key={r.rowNum}>Row {r.rowNum}: {r.warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Re-pick */}
                <button
                  onClick={() => { setStep('upload'); setFile(null); setRows([]); if (fileRef.current) fileRef.current.value = ''; }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 underline"
                >
                  Choose a different file
                </button>
              </>
            )}

            {/* ── Step: result ── */}
            {step === 'result' && result && (
              <div className={`p-4 rounded-md ${
                result.failed === 0
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-yellow-50 border border-yellow-200'
              }`}>
                <div className="flex items-center space-x-2 mb-2">
                  {result.failed === 0 ? (
                    <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  )}
                  <p className="text-sm font-semibold">
                    {result.failed === 0 ? 'Import complete!' : 'Import finished with errors'}
                  </p>
                </div>
                <p className="text-sm mb-2">
                  <span className="text-green-700 font-medium">{result.successful} imported</span>
                  {result.failed > 0 && (
                    <> · <span className="text-red-600 font-medium">{result.failed} failed</span></>
                  )}
                </p>
                {result.errors.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-1">Errors:</p>
                    <ul className="list-disc list-inside text-xs text-gray-600 max-h-36 overflow-y-auto space-y-0.5">
                      {result.errors.slice(0, 20).map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                      {result.errors.length > 20 && (
                        <li className="font-semibold">… and {result.errors.length - 20} more</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Footer buttons ── */}
          <div className="bg-gray-50 px-6 py-3 flex items-center justify-between">
            <button
              onClick={step === 'result' ? handleDone : onClose}
              disabled={importing}
              className="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {step === 'result' ? 'Done' : 'Cancel'}
            </button>

            {step === 'preview' && (
              <button
                onClick={handleImport}
                disabled={importing || validRows.length === 0}
                className="inline-flex items-center justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {importing ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Importing…
                  </>
                ) : (
                  `Import ${validRows.length} employee${validRows.length !== 1 ? 's' : ''} →`
                )}
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
