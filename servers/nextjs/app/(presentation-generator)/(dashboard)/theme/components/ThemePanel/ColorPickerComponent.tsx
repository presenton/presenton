"use client";
import React from 'react'

import { HexColorPicker, HexColorInput } from 'react-colorful'
import { ThemeColors } from './types'

interface ColorPickerComponentProps {
  colorKey: keyof ThemeColors
  currentColor: string
  onColorChange: (colorKey: keyof ThemeColors, value: string) => void
  showColorPicker: string | null
  onShowColorPicker: (colorKey: string | null) => void,
  label: string
}

export const ColorPickerComponent: React.FC<ColorPickerComponentProps> = ({
  colorKey,
  currentColor,
  onColorChange,
  showColorPicker,
  onShowColorPicker,
  label
}) => (
  <div className="">
    {label && <p className="text-xs text-[#38393D] font-medium pb-1.5">
      {label}
    </p>}
    <div className="flex gap-2 border border-[#EDEEEF] rounded-md p-1">
      <div
        className="w-8 h-8 rounded border border-gray-300 cursor-pointer relative"
        style={{ backgroundColor: currentColor }}
        onClick={(e) => {
          e.stopPropagation()
          onShowColorPicker(showColorPicker === colorKey ? null : colorKey)
        }}
      >
        {showColorPicker === colorKey && (
          <div
            className="absolute top-full left-0 z-[9999] mt-2 bg-white border border-gray-300 rounded-lg shadow-lg p-2"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <HexColorPicker
              color={currentColor}
              onChange={(color) => onColorChange(colorKey, color)}
            />
            <div className="mt-2">
              <HexColorInput
                color={currentColor}
                onChange={(color) => onColorChange(colorKey, color)}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded outline-none "
                prefixed
              />
            </div>
          </div>
        )}
      </div>
      <input
        className='w-full outline-none  text-sm font-medium text-[#38393D]'
        value={currentColor}
        onChange={(e) => onColorChange(colorKey, e.target.value)}
        placeholder="#000000"
      />
    </div>
  </div>
)
