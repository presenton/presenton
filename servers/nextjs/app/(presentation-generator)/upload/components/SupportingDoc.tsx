'use client'

import React, { ChangeEvent, useEffect, useMemo, useState } from 'react'
import { File, Paperclip, Plus, X } from 'lucide-react'
import { toast } from 'sonner'

interface SupportingDocProps {
    files: File[]
    onFilesChange: (files: File[]) => void
    accept?: string
    multiple?: boolean
}

const MAX_SUPPORTED_FILES = 8

const PDF_TYPES = ['.pdf']
const TEXT_TYPES = ['.txt']
const WORD_TYPES = ['.doc', '.docx', '.docm', '.odt', '.rtf']
const POWERPOINT_TYPES = ['.ppt', '.pptx', '.pptm', '.odp']
const SPREADSHEET_TYPES = ['.xls', '.xlsx', '.xlsm', '.ods', '.csv', '.tsv']
const IMAGE_TYPES = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp', '.svg']

const ALLOWED_MIME_PREFIXES: string[] = ['image/']
const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/csv',
    'text/tab-separated-values',
    'text/tsv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-word.document.macroenabled.12',
    'application/vnd.oasis.opendocument.text',
    'application/rtf',
    'text/rtf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint.presentation.macroenabled.12',
    'application/vnd.oasis.opendocument.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel.sheet.macroenabled.12',
    'application/vnd.oasis.opendocument.spreadsheet',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/bmp',
    'image/tiff',
    'image/webp',
    'image/svg+xml',
]
const ALLOWED_EXTENSIONS = [
    ...PDF_TYPES,
    ...TEXT_TYPES,
    ...WORD_TYPES,
    ...POWERPOINT_TYPES,
    ...SPREADSHEET_TYPES,
    ...IMAGE_TYPES,
]
const ACCEPT_DEFAULT = [...ALLOWED_MIME_TYPES, ...ALLOWED_EXTENSIONS].join(',')

const SupportingDoc = ({
    files,
    onFilesChange,
    accept = ACCEPT_DEFAULT,
    multiple = true,
}: SupportingDocProps) => {
    const [isDragging, setIsDragging] = useState(false)
    const [previewUrls, setPreviewUrls] = useState<(string | null)[]>([])

    const hasFiles = files.length > 0

    const filteredFiles = useMemo(() => {
        return files.filter(isAllowedFile)
    }, [files])

    useEffect(() => {
        const urls = filteredFiles.map((file) => (file.type.startsWith('image/') ? URL.createObjectURL(file) : null))
        setPreviewUrls(urls)

        return () => {
            urls.forEach((url) => {
                if (url) URL.revokeObjectURL(url)
            })
        }
    }, [filteredFiles])

    const handleValidate = (filesToReview: File[]) => {
        const disallowed = filesToReview.filter((file) => !isAllowedFile(file))
        if (disallowed.length > 0) {
            toast.error('Some files are not supported', {
                description: 'Supported: Word, PowerPoint, spreadsheets, PDF/TXT, and image files.',
            })
        }
    }

    const applyFileLimit = (candidateFiles: File[]) => {
        if (candidateFiles.length <= MAX_SUPPORTED_FILES) {
            return candidateFiles
        }

        toast.warning('Maximum file limit reached', {
            description: `You can upload up to ${MAX_SUPPORTED_FILES} documents only.`,
        })

        return candidateFiles.slice(0, MAX_SUPPORTED_FILES)
    }

    const handleFilesSelected = (e: ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files ?? [])
        if (selectedFiles.length === 0) return

        const nextFiles = multiple ? [...files, ...selectedFiles] : [selectedFiles[0]]
        const allowedFiles = applyFileLimit(nextFiles.filter(isAllowedFile))

        onFilesChange(allowedFiles)
        handleValidate(nextFiles)
        if (allowedFiles.length > files.length) {
            toast.success('Files selected', {
                description: `${allowedFiles.length - files.length} file(s) have been added`,
            })
        }
        e.currentTarget.value = ''
    }

    const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault()
        setIsDragging(false)

        const droppedFiles = Array.from(e.dataTransfer.files ?? [])
        if (droppedFiles.length === 0) return

        const nextFiles = multiple ? [...files, ...droppedFiles] : [droppedFiles[0]]
        const allowedFiles = applyFileLimit(nextFiles.filter(isAllowedFile))

        onFilesChange(allowedFiles)
        handleValidate(nextFiles)
        if (allowedFiles.length > files.length) {
            toast.success('Files selected', {
                description: `${allowedFiles.length - files.length} file(s) have been added`,
            })
        }
    }

    const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault()
        setIsDragging(false)
    }

    const handleRemoveFileAt = (index: number) => {
        const nextFiles = filteredFiles.filter((_, i) => i !== index)
        onFilesChange(nextFiles)
    }

    const handleClearFiles = () => {
        if (!hasFiles) return
        onFilesChange([])
    }

    return (
        <div className="space-y-2" data-testid="attachments-uploader">
            <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600 font-syne">
                    {hasFiles ? `${filteredFiles.length} attachment${filteredFiles.length > 1 ? 's' : ''}` : ''}
                </p>
                {hasFiles && <button
                    type="button"
                    onClick={handleClearFiles}
                    disabled={!hasFiles}
                    className={`text-sm font-medium font-syne ${!hasFiles ? 'cursor-not-allowed text-gray-400' : 'text-red-600 hover:text-red-700'}`}
                    data-testid="attachments-clear-button"
                    aria-disabled={!hasFiles}
                >
                    Clear all
                </button>}
            </div>

            <label
                className={`mt-1 block cursor-pointer rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${isDragging ? 'border-[#5146E5] bg-[#5146E5]/5' : 'border-gray-200 hover:border-[#5146E5]'}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <input
                    type="file"
                    className="hidden"
                    onChange={handleFilesSelected}
                    accept={accept}
                    multiple={multiple}
                    data-testid="file-upload-input"
                />
                <div className="flex flex-col items-center gap-2">
                    <div className='w-[42px] h-[42px] flex justify-center items-center rounded-full bg-[#EBE9FE]' >
                        <div className='w-[22px] h-[22px] rounded-full bg-[#7A5AF8] flex items-center justify-center text-white'>
                            <Plus className='w-3 h-3' />
                        </div>
                    </div>
                    <p className='text-[#808080] text-sm  font-normal'>(Office docs, spreadsheets, images, PDF/TXT)</p>
                </div>
            </label>

            {hasFiles && (
                <div className="mt-2">
                    <ul data-testid="file-list" className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="Attached files">
                        {filteredFiles.map((file, idx) => (
                            <li
                                key={`${file.name}-${idx}`}
                                className="flex items-center gap-3 rounded-md border border-gray-200 px-3 py-2"
                                data-testid="attached-file-item"
                            >
                                {previewUrls[idx] ? (
                                    <img src={previewUrls[idx] as string} alt="Preview" className="h-10 w-10 flex-none rounded object-cover" />
                                ) : (
                                    <div className="flex h-10 w-10 flex-none items-center justify-center rounded bg-gray-100 text-gray-600">
                                        <File className="h-5 w-5" />
                                    </div>
                                )}

                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-gray-900 font-syne" title={file.name}>
                                        {file.name}
                                    </p>
                                    <p className="text-xs text-gray-500 font-syne">{formatFileSize(file.size)}</p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => handleRemoveFileAt(idx)}
                                    className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded text-red-600 hover:bg-red-50 hover:text-red-700"
                                    aria-label={`Remove ${file.name}`}
                                    data-testid="remove-file-button"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </li>
                        ))}
                    </ul>
                    {filteredFiles.length !== files.length && (
                        <p className="mt-2 text-xs text-amber-600 font-syne">
                            Some files were skipped. Supported: Word, PowerPoint, spreadsheets, PDF/TXT, and image files.
                        </p>
                    )}
                </div>
            )}
        </div>
    )
}

const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0 KB'
    return `${(bytes / 1024).toFixed(1)} KB`
}

function isAllowedFile(file: File): boolean {
    const type = (file.type || '').toLowerCase()
    const name = (file.name || '').toLowerCase()
    const typeAllowed = ALLOWED_MIME_TYPES.includes(type) || ALLOWED_MIME_PREFIXES.some((prefix) => type.startsWith(prefix))

    if (typeAllowed) return true
    return ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext))
}

export default SupportingDoc
