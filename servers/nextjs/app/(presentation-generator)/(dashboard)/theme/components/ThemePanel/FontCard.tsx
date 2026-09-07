"use client";
import React from 'react'
import { Check } from 'lucide-react'

interface FontCardProps {
  font: any
  isSelected: boolean
  onSelect: (fontName: string) => void
}

export const FontCard: React.FC<FontCardProps> = ({ font, isSelected, onSelect }) => (
  <div
    className={`relative p-3 rounded-xl cursor-pointer transition-all duration-200 group
      ${isSelected
        ? 'bg-gradient-to-br from-[#EFF6FF] to-[#F0EFFF] border border-[#2563EB] shadow-sm'
        : 'bg-white border border-[#EDEEEF] hover:border-[#C4B5FD] hover:bg-[#FAFAFF]'
      }`}
    onClick={() => onSelect(font.name)}
  >

    <div className="flex items-center justify-between gap-2">
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium truncate ${isSelected ? 'text-[#2563EB]' : 'text-[#151515]'}`}
          style={{ fontFamily: `"${font.name}"` }}
        >
          {font.displayName}
        </p>
        <p
          className="text-[11px] text-[#A6A4A2] mt-0.5"
          style={{ fontFamily: `"${font.name}"` }}
        >
          ABC abc 123
        </p>
      </div>
      <div
        className={`text-xl font-semibold ${isSelected ? 'text-[#2563EB]' : 'text-[#333] group-hover:text-[#2563EB]'} transition-colors`}
        style={{ fontFamily: `"${font.name}"` }}
      >
        Aa
      </div>
    </div>
  </div>
)
