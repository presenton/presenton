'use client'

import React, { ChangeEvent, useEffect, useMemo, useState } from 'react'
import { File, Paperclip, Plus, X } from 'lucide-react'
import { notify } from '@/components/ui/sonner'

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
const IMAGE_TYPES = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp']

const ALLOWED_MIME_PREFIXES: string[] = []
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
            notify.error('Some files are not supported', 'Supported: Word, PowerPoint, spreadsheets, PDF/TXT, and image files.')
        }
    }

    const applyFileLimit = (candidateFiles: File[]) => {
        if (candidateFiles.length <= MAX_SUPPORTED_FILES) {
            return candidateFiles
        }

        notify.warning('Maximum file limit reached', `You can upload up to ${MAX_SUPPORTED_FILES} documents only.`)

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
            notify.success('Files selected', `${allowedFiles.length - files.length} file(s) have been added.`)
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
            notify.success('Files selected', `${allowedFiles.length - files.length} file(s) have been added.`)
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
        <div className="space-y-2 min-[1800px]:space-y-3" data-testid="attachments-uploader">
            <div className="flex items-center justify-between">
                <p className="font-syne text-sm text-gray-600 min-[1800px]:text-base min-[2200px]:text-lg">
                    {hasFiles ? `${filteredFiles.length} attachment${filteredFiles.length > 1 ? 's' : ''}` : ''}
                </p>
                {hasFiles && <button
                    type="button"
                    onClick={handleClearFiles}
                    disabled={!hasFiles}
                    className={`font-syne text-sm font-medium min-[1800px]:text-base ${!hasFiles ? 'cursor-not-allowed text-gray-400' : 'text-red-600 hover:text-red-700'}`}
                    data-testid="attachments-clear-button"
                    aria-disabled={!hasFiles}
                >
                    Clear all
                </button>}
            </div>

            <label
                className={`mt-1 block cursor-pointer rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors min-[1800px]:px-5 min-[1800px]:py-8 min-[2200px]:px-6 min-[2200px]:py-10 ${isDragging ? 'border-[#5146E5] bg-[#5146E5]/5' : 'border-gray-200 hover:border-[#5146E5]'}`}
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
                <div className="flex flex-col items-center gap-2 min-[1800px]:gap-3">
                    <div className='flex h-[42px] w-[42px] items-center justify-center rounded-full bg-[#EBE9FE] min-[1800px]:h-[50px] min-[1800px]:w-[50px] min-[2200px]:h-[58px] min-[2200px]:w-[58px]' >
                        <div className='flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#7A5AF8] text-white min-[1800px]:h-[28px] min-[1800px]:w-[28px] min-[2200px]:h-[32px] min-[2200px]:w-[32px]'>
                            <Plus className='h-3 w-3 min-[1800px]:h-4 min-[1800px]:w-4 min-[2200px]:h-5 min-[2200px]:w-5' />
                        </div>
                    </div>
                    <p className='text-sm font-normal text-[#808080] min-[1800px]:text-base min-[2200px]:text-lg'>(Office docs, spreadsheets, images, PDF/TXT)</p>
                </div>
            </label>

            {hasFiles && (
                <div className="mt-2">
                    <ul data-testid="file-list" className="grid grid-cols-1 gap-2 sm:grid-cols-2 min-[1800px]:gap-3" aria-label="Attached files">
                        {filteredFiles.map((file, idx) => (
                            <li
                                key={`${file.name}-${idx}`}
                                className="flex items-center gap-3 rounded-md border border-gray-200 px-3 py-2 min-[1800px]:gap-4 min-[1800px]:px-4 min-[1800px]:py-3"
                                data-testid="attached-file-item"
                            >
                                {previewUrls[idx] ? (
                                    <img src={previewUrls[idx] as string} alt="Preview" className="h-10 w-10 flex-none rounded object-cover min-[1800px]:h-12 min-[1800px]:w-12 min-[2200px]:h-14 min-[2200px]:w-14" />
                                ) : (
                                    <div className="flex h-10 w-10 flex-none items-center justify-center rounded bg-gray-100 text-gray-600 min-[1800px]:h-12 min-[1800px]:w-12 min-[2200px]:h-14 min-[2200px]:w-14">
                                        <File className="h-5 w-5 min-[1800px]:h-6 min-[1800px]:w-6" />
                                    </div>
                                )}

                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-syne text-sm font-medium text-gray-900 min-[1800px]:text-base min-[2200px]:text-lg" title={file.name}>
                                        {file.name}
                                    </p>
                                    <p className="font-syne text-xs text-gray-500 min-[1800px]:text-sm min-[2200px]:text-base">{formatFileSize(file.size)}</p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => handleRemoveFileAt(idx)}
                                    className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded text-red-600 hover:bg-red-50 hover:text-red-700 min-[1800px]:h-10 min-[1800px]:w-10"
                                    aria-label={`Remove ${file.name}`}
                                    data-testid="remove-file-button"
                                >
                                    <X className="h-5 w-5 min-[1800px]:h-6 min-[1800px]:w-6" />
                                </button>
                            </li>
                        ))}
                    </ul>
                    {filteredFiles.length !== files.length && (
                        <p className="mt-2 font-syne text-xs text-amber-600 min-[1800px]:text-sm">
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
