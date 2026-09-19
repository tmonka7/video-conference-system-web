import { useCallback, useEffect, useRef, useState } from 'react';
import { formatBytes, formatDate } from '@vcs/shared';
import { assetUrl, filesApi } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { Button, EmptyState, PageLoader } from '@/components/ui';
import { FileIcon, TrashIcon, UploadIcon } from '@/components/icons';

/** Colour the icon by family, so a list of files is scannable. */
function fileTone(mimeType = '', name = '') {
  const extension = name.split('.').pop()?.toLowerCase();
  if (mimeType.includes('pdf') || extension === 'pdf') return 'bg-red-50 text-red-600';
  if (['ppt', 'pptx'].includes(extension)) return 'bg-orange-50 text-orange-600';
  if (['doc', 'docx'].includes(extension)) return 'bg-brand-50 text-brand-600';
  if (['xls', 'xlsx', 'csv'].includes(extension)) return 'bg-emerald-50 text-emerald-600';
  if (mimeType.startsWith('image/')) return 'bg-indigo-50 text-indigo-600';
  return 'bg-slate-100 text-slate-500';
}

/** Screen 14: "Share Files". */
export default function Files() {
  const toast = useToast();
  const inputRef = useRef(null);

  const [files, setFiles] = useState(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      const page = await filesApi.list({ limit: 100 });
      setFiles(page.items);
    } catch (error) {
      toast.error(error.message);
      setFiles([]);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const upload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      await filesApi.upload(file);
      toast.success(`${file.name} uploaded`);
      load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setUploading(false);
      // Allows re-picking the same file straight after a failure.
      event.target.value = '';
    }
  };

  const remove = async (file) => {
    try {
      await filesApi.remove(file.id);
      toast.success('File deleted');
      load();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-slate-900">Share Files</h1>
        <Button loading={uploading} onClick={() => inputRef.current?.click()}>
          <UploadIcon className="h-4 w-4" />
          Upload File
        </Button>
        <input ref={inputRef} type="file" className="hidden" onChange={upload} />
      </div>

      <div className="mt-6">
        {files === null ? (
          <PageLoader label="Loading files" />
        ) : files.length === 0 ? (
          <EmptyState
            title="No files yet"
            description="Upload documents to share them in a meeting or a chat."
            action={<Button onClick={() => inputRef.current?.click()}>Upload a file</Button>}
          />
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-left">
              <thead className="border-b border-slate-100 text-sm text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="hidden px-5 py-3 font-medium sm:table-cell">Size</th>
                  <th className="hidden px-5 py-3 font-medium sm:table-cell">Modified</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {files.map((file) => (
                  <tr key={file.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3.5">
                      <a
                        href={assetUrl(file.url)}
                        className="flex items-center gap-3"
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span
                          className={`flex h-9 w-9 items-center justify-center rounded-lg ${fileTone(file.mimeType, file.name)}`}
                        >
                          <FileIcon className="h-5 w-5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-slate-800">
                            {file.name}
                          </span>
                          <span className="block text-xs text-slate-400 sm:hidden">
                            {formatBytes(file.size)} · {formatDate(file.updatedAt)}
                          </span>
                        </span>
                      </a>
                    </td>
                    <td className="hidden px-5 py-3.5 text-sm text-slate-500 sm:table-cell">
                      {formatBytes(file.size)}
                    </td>
                    <td className="hidden px-5 py-3.5 text-sm text-slate-500 sm:table-cell">
                      {formatDate(file.updatedAt)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => remove(file)}
                        aria-label={`Delete ${file.name}`}
                        className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <TrashIcon />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
