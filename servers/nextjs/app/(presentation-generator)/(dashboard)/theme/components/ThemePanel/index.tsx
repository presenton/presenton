'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Loader2,
  SquarePen,
  RefreshCcw,
  ChevronRight,
  Plus
} from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'


import { ThemeColors } from './types'
import { FONT_OPTIONS, DEFAULT_THEMES } from './constants'


import { StepIndicator } from './StepIndicator'
import { ColorPickerComponent } from './ColorPickerComponent'
import { FontCard } from './FontCard'
import { ThemeCard } from './ThemeCard'

import { toast } from 'sonner'
import { Theme, ThemeParams } from '@/app/(presentation-generator)/services/api/types'
import { ImagesApi } from '@/app/(presentation-generator)/services/api/images'
import { Input } from '@/components/ui/input'
import { getTemplatesByTemplateName } from '@/app/presentation-templates'
import { usePathname, useSearchParams } from 'next/navigation'
import CustomTabEmpty from './CustomTabEmpty'
import ThemeApi from '@/app/(presentation-generator)/services/api/theme'
import { useFontLoader } from '@/app/(presentation-generator)/hooks/useFontLoad'
import Link from 'next/link'
import { MixpanelEvent, trackEvent } from '@/utils/mixpanel'

// Fallback theme used before defaults are loaded from API (unified Theme type)
const FALLBACK_THEME: Theme = {
  id: 'standard',
  name: 'Standard',
  description: 'Standard theme',
  user: 'system',
  logo: '',
  logo_url: '',
  data: {
    colors: {
      'primary': '#2563eb',
      'background': '#ffffff',
      'card': '#f8fafc',
      'stroke': '#e5e7eb',
      'primary_text': '#1e293b',
      'background_text': '#475569',
      'graph_0': '#2563eb',
      'graph_1': '#1d4ed8',
      'graph_2': '#1e40af',
      'graph_3': '#1e40af',
      'graph_4': '#1e40af',
      'graph_5': '#1e40af',
      'graph_6': '#1e40af',
      'graph_7': '#1e40af',
      'graph_8': '#1e40af',
      'graph_9': '#1e40af',
    },
    fonts: {
      textFont: { name: 'Inter', url: 'https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap' },
    },
  },
}
const ThemePanel: React.FC = () => {
  const searchParams = useSearchParams()
  const pathname = usePathname()


  const [selectedTheme, setSelectedTheme] = useState<Theme>(FALLBACK_THEME)
  const [tab, setTab] = useState<'custom' | 'default'>('default')

  const [customColors, setCustomColors] = useState<ThemeColors>(FALLBACK_THEME.data.colors)
  const [customFonts, setCustomFonts] = useState<{ textFont: { name: string, url: string } }>(FALLBACK_THEME.data.fonts)
  const [customBrandLogo, setCustomBrandLogo] = useState<string | null>(null)
  const [customBrandLogoId, setCustomBrandLogoId] = useState<string | null>(null)
  const [isLogoUploading, setIsLogoUploading] = useState<boolean>(false)
  const [isFontUploading, setIsFontUploading] = useState<boolean>(false)
  const [customThemes, setCustomThemes] = useState<Theme[]>([])
  const [defaultThemes, setDefaultThemes] = useState<Theme[]>([])
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [themeCompanyName, setThemeCompanyName] = useState('')
  const [isNewTheme, setIsNewTheme] = useState(false)
  const [userFonts, setUserFonts] = useState<{ fonts: { name: string, url: string }[] }>({ fonts: [] })

  const previewContainerRef = useRef<HTMLDivElement>(null)
  const slideContainerRef = useRef<HTMLDivElement>(null)
  const [slideContainerWidth, setSlideContainerWidth] = useState<number>(0)

  useEffect(() => {
    trackEvent(MixpanelEvent.Theme_Page_Viewed, { pathname })
  }, [pathname])

  // Calculate scale dynamically based on container width
  const slideScale = () => {
    const BASE_WIDTH = 1280
    const SCROLLBAR_WIDTH = 8 // account for scrollbar
    if (!slideContainerWidth) return 0.68 // fallback
    const availableWidth = slideContainerWidth - SCROLLBAR_WIDTH
    return availableWidth / BASE_WIDTH
  }

  useEffect(() => {
    const el = slideContainerRef.current
    if (!el) return

    const ro = new ResizeObserver(() => {
      setSlideContainerWidth(el.clientWidth)
    })
    ro.observe(el)
    setSlideContainerWidth(el.clientWidth)

    return () => ro.disconnect()
  }, [isSheetOpen, slideContainerRef])



  const handleCloseSheet = (open: boolean) => {
    setIsSheetOpen(false)
    if (!open) {
      window.history.pushState({}, '', '/theme')
    }
  }

  // Initialize theme on component mount
  useEffect(() => {
    applyTheme(selectedTheme)
  }, [])

  // Load custom themes from API and built-in themes from local constants
  useEffect(() => {

    const loadCustomThemes = async () => {
      try {
        const apiThemes = await ThemeApi.getThemes()
        setCustomThemes(apiThemes)
        const fonts = apiThemes.map(theme => theme.data.fonts.textFont)

        const fontMap = fonts.map(font => ({ name: font.name, url: font.url }))
        fontMap.forEach(font => {
          useFontLoader({ [font.name]: font.url })
        })
      } catch (error: any) {
        console.error('Failed to load custom themes', error)
        toast.error(error?.message || 'Failed to load custom themes')
      }
    }
    const loadUserFonts = async () => {
      try {
        const userFonts = await ThemeApi.getUserFonts()
        setUserFonts(userFonts)
      } catch (error: any) {
        console.error('Failed to load user fonts', error)
        toast.error(error?.message || 'Failed to load user fonts')
      }
    }
    loadUserFonts()
    const loadDefaultThemes = () => {
      const localDefaults: Theme[] = DEFAULT_THEMES.map((theme) => ({
        ...theme,
        user: 'system',
        logo: theme.logo ?? '',
        logo_url: theme.logo_url ?? '',
        company_name: theme.company_name ?? '',
      }))

      setDefaultThemes(localDefaults)

      // If selected theme is still fallback, set first default
      if (localDefaults.length > 0 && selectedTheme.id === FALLBACK_THEME.id) {
        const first = localDefaults[0]
        setSelectedTheme(first)
        setCustomColors(first.data.colors)
        setCustomFonts(first.data.fonts)
        setCustomBrandLogo(first.logo_url || null)
        setCustomBrandLogoId((first as any).logo || '')
        applyTheme(first)
      }
    }
    loadCustomThemes()
    loadDefaultThemes()
  }, [])


  useEffect(() => {
    const updatedTheme: Theme = {
      ...selectedTheme,
      logo_url: customBrandLogo || selectedTheme.logo_url,
      company_name: themeCompanyName || selectedTheme.company_name,
      data: {
        ...selectedTheme.data,
        colors: customColors,
        fonts: customFonts,
      },
    }
    applyTheme(updatedTheme)
  }, [customColors, customFonts, customBrandLogo, selectedTheme])

  // Reset custom values only when the selected theme ID changes
  useEffect(() => {
    if (selectedTheme) {
      setCustomColors(selectedTheme.data.colors)
      setCustomFonts(selectedTheme.data.fonts)
      setCustomBrandLogo(selectedTheme.logo_url || '')
      setCustomBrandLogoId((selectedTheme as any).logo || '')

    }
  }, [selectedTheme.id])



  const template = getTemplatesByTemplateName('neo-general')
  const applyTheme = (theme: Theme) => {
    const cssVariables = {
      '--primary-color': theme.data.colors['primary'],
      '--background-color': theme.data.colors['background'],
      '--card-color': theme.data.colors['card'],
      '--stroke': theme.data.colors['stroke'],
      '--primary-text': theme.data.colors['primary_text'],
      '--background-text': theme.data.colors['background_text'],
      '--graph-0': theme.data.colors['graph_0'],
      '--graph-1': theme.data.colors['graph_1'],
      '--graph-2': theme.data.colors['graph_2'],
      '--graph-3': theme.data.colors['graph_3'],
      '--graph-4': theme.data.colors['graph_4'],
      '--graph-5': theme.data.colors['graph_5'],
      '--graph-6': theme.data.colors['graph_6'],
      '--graph-7': theme.data.colors['graph_7'],
      '--graph-8': theme.data.colors['graph_8'],
      '--graph-9': theme.data.colors['graph_9'],
    }



    // Apply theme to preview container
    if (slideContainerRef.current) {

      Object.entries(cssVariables).forEach(([key, value]) => {
        slideContainerRef.current!.style.setProperty(key, value)
      })

      // Apply fonts to preview container
      slideContainerRef.current!.style.setProperty('font-family', `"${theme.data.fonts.textFont.name}"`)
      slideContainerRef.current!.style.setProperty('--heading-font-family', `"${theme.data.fonts.textFont.name}"`)
      // Load font
      useFontLoader({ [theme.data.fonts.textFont.name]: theme.data.fonts.textFont.url })
    }
  }

  const handleThemeSelect = (theme: Theme) => {
    setIsNewTheme(false)
    setSelectedTheme(theme)
    setCustomColors(theme.data.colors)
    setCustomFonts(theme.data.fonts)
    setCustomBrandLogo(theme.logo_url || '')
    setIsSheetOpen(true)
    setCurrentStep(1)

    setThemeCompanyName(theme.company_name || '')
    applyTheme(theme)
    trackEvent(MixpanelEvent.Theme_Selected, {
      pathname,
      theme_id: theme.id,
      theme_name: theme.name,
      theme_source: theme.user === 'system' ? 'built_in' : 'custom',
    })
    trackEvent(MixpanelEvent.Theme_Editor_Opened, {
      pathname,
      theme_id: theme.id,
      theme_name: theme.name,
      theme_source: theme.user === 'system' ? 'built_in' : 'custom',
    })
  }

  const handleColorChange = (colorKey: keyof ThemeColors, value: string) => {
    let validValue = value
    if (value && !value.startsWith('#')) {
      validValue = `#${value}`
    }

    const newColors = { ...customColors, [colorKey]: validValue }
    setCustomColors(newColors)
  }

  const handleFontSelect = (fontName: string, url: string) => {
    setCustomFonts({ textFont: { name: fontName, url: url } })
    trackEvent(MixpanelEvent.Theme_Font_Changed, {
      pathname,
      font_name: fontName,
      font_url: url,
      theme_id: selectedTheme.id,
    })
  }

  const handleBrandLogoUpload = async (file: File) => {
    try {
      setIsLogoUploading(true)
      const uploaded = await ImagesApi.uploadImage(file)
      setCustomBrandLogo(uploaded.path)
      setCustomBrandLogoId(uploaded.id)
      trackEvent(MixpanelEvent.Theme_Logo_Uploaded, {
        pathname,
        theme_id: selectedTheme.id,
        file_name: file.name,
        file_size_bytes: file.size,
      })
    } catch (error: any) {
      console.error('Failed to upload logo', error)
      toast.error(error?.message || 'Failed to upload logo')
    } finally {
      setIsLogoUploading(false)
    }
  }

  const generateTheme = async ({
    primary,
    background,
    source,
  }: { primary?: string, background?: string; source: "new_theme" | "refresh" }): Promise<ThemeColors> => {
    const generatedTheme = await ThemeApi.generateTheme({ primary, background })
    trackEvent(MixpanelEvent.Theme_Palette_Generated, {
      pathname,
      source,
      theme_id: selectedTheme.id,
      has_primary_seed: Boolean(primary),
      has_background_seed: Boolean(background),
    })
    return {
      'primary': generatedTheme.primary,
      'background': generatedTheme.background,
      'card': generatedTheme.card,
      'stroke': generatedTheme.stroke,
      'primary_text': generatedTheme['primary_text'],
      'background_text': generatedTheme['background_text'],
      'graph_0': generatedTheme['graph_0'],
      'graph_1': generatedTheme['graph_1'],
      'graph_2': generatedTheme['graph_2'],
      'graph_3': generatedTheme['graph_3'],
      'graph_4': generatedTheme['graph_4'],
      'graph_5': generatedTheme['graph_5'],
      'graph_6': generatedTheme['graph_6'],
      'graph_7': generatedTheme['graph_7'],
      'graph_8': generatedTheme['graph_8'],
      'graph_9': generatedTheme['graph_9'],
    }
  }

  const createNewCustomTheme = async () => {
    trackEvent(MixpanelEvent.Theme_New_Theme_Clicked, { pathname })
    setIsNewTheme(true)
    const newTheme: Theme = {
      id: `custom-${Date.now()}`,
      name: 'New Custom Theme',
      description: 'Start with a blank canvas',
      user: 'local',
      logo: '',
      logo_url: '',
      company_name: '',
      data: {
        colors: {
          'primary': '#0000c3',
          'background': '#f1fff3',
          'card': '#deece1',
          'stroke': '#c8d5ca',
          'primary_text': '#f1f1f1',
          'background_text': '#030101',
          'graph_0': '#7eeeff',
          'graph_1': '#70e0ff',
          'graph_2': '#58c7ff',
          'graph_3': '#3cabff',
          'graph_4': '#198fff',
          'graph_5': '#0073ff',
          'graph_6': '#0056ff',
          'graph_7': '#0036ed',
          'graph_8': '#0000d0',
          'graph_9': '#0000b4',
        },
        fonts: {
          textFont: { name: 'Inter', url: 'https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap' },
        }
      }
    }

    const generatedColors = await generateTheme({ source: "new_theme" })


    const theme = {
      ...newTheme,
      data: {
        ...newTheme.data,
        colors: generatedColors,

      }
    }
    setSelectedTheme(theme)
    setCustomColors(theme.data.colors)
    setCustomFonts(theme.data.fonts)
    setCustomBrandLogo('')
    setIsSheetOpen(true)
    setCurrentStep(1)

    setThemeCompanyName('')
    applyTheme(theme)
    trackEvent(MixpanelEvent.Theme_Editor_Opened, {
      pathname,
      theme_id: theme.id,
      theme_name: theme.name,
      theme_source: "new_draft",
    })
  }

  const refeshTheme = async ({ primary, background }: { primary?: string, background?: string }) => {
    const generatedTheme = await generateTheme({ primary, background, source: "refresh" })
    setCustomColors(generatedTheme)
  }
  const saveAsCustom = async () => {
    // If existing persisted custom theme, update via API (non-system and not a local draft)
    if (selectedTheme.user && selectedTheme.user !== 'system' && !selectedTheme.id.startsWith('custom-')) {
      ; (async () => {
        try {
          trackEvent(MixpanelEvent.Theme_Save_Started, {
            pathname,
            mode: "update",
            theme_id: selectedTheme.id,
            theme_name: selectedTheme.name,
          })
          const params: ThemeParams = {
            id: selectedTheme.id,
            name: selectedTheme.name,
            description: selectedTheme.description,
            logo: customBrandLogoId || null,
            logo_url: customBrandLogo || null,
            company_name: themeCompanyName || null,
            data: {
              colors: customColors,
              fonts: customFonts,
            }
          }
          const updated = await ThemeApi.updateTheme(params)
          setCustomThemes(customThemes.map(t => t.id === updated.id ? updated : t))
          setSelectedTheme(updated)
          setIsSheetOpen(false)
          trackEvent(MixpanelEvent.Theme_Saved, {
            pathname,
            mode: "update",
            theme_id: updated.id,
            theme_name: updated.name,
            has_logo: Boolean(updated.logo_url),
            font_name: updated.data?.fonts?.textFont?.name || "",
          })
          toast.success('Theme updated')
        } catch (error: any) {
          console.error('Failed to update theme', error)
          toast.error(error?.message || 'Failed to update theme')
        }
      })()
      return
    }
    try {
      trackEvent(MixpanelEvent.Theme_Save_Started, {
        pathname,
        mode: "create",
        theme_id: selectedTheme.id,
        theme_name: selectedTheme.name,
      })
      const params: ThemeParams = {
        name: selectedTheme.name,
        description: selectedTheme.description || `Custom version of ${selectedTheme.name}`,
        logo: customBrandLogoId || null,
        logo_url: customBrandLogo || null,
        company_name: themeCompanyName || null,
        data: {
          colors: customColors,
          fonts: customFonts,
        }
      }
      const created = await ThemeApi.createTheme(params)
      setCustomThemes([...customThemes, created])
      setSelectedTheme(created)
      setIsSheetOpen(false)


      window.history.pushState({}, '', '/theme')
      trackEvent(MixpanelEvent.Theme_Saved, {
        pathname,
        mode: "create",
        theme_id: created.id,
        theme_name: created.name,
        has_logo: Boolean(created.logo_url),
        font_name: created.data?.fonts?.textFont?.name || "",
      })
      toast.success('Theme saved')
    } catch (error: any) {
      console.error('Failed to save theme', error)
      toast.error(error?.message || 'Failed to save theme')
    }
  }

  const handleClickOutside = () => {
    setShowColorPicker(null)
  }
  const handleDelete = async (themeId: string) => {
    await ThemeApi.deleteTheme(themeId)
    setCustomThemes(customThemes.filter(theme => theme.id !== themeId))
    trackEvent(MixpanelEvent.Theme_Deleted, {
      pathname,
      theme_id: themeId,
    })
    toast.success("Theme deleted successfully")
  }
  const handleCustomFontChange = async (fontFile: File) => {
    try {
      setIsFontUploading(true)
      const { font_name, font_url } = await ThemeApi.uploadFont(fontFile)
      setCustomFonts({
        textFont: {
          name: font_name,
          url: font_url,
        }
      })
      trackEvent(MixpanelEvent.Theme_Custom_Font_Uploaded, {
        pathname,
        font_name: name,
        file_name: fontFile.name,
        file_size_bytes: fontFile.size,
      })
      trackEvent(MixpanelEvent.Theme_Font_Changed, {
        pathname,
        theme_id: selectedTheme.id,
        font_name: font_name,
        font_url: font_url,
        source: "uploaded_font",
      })
      // Add the newly uploaded font to userFonts if not already present
      if (!userFonts.fonts.find(f => f.name === font_name)) {
        setUserFonts(prev => ({
          fonts: [...prev.fonts, { name: font_name, url: font_url }]
        }))
      }
      toast.success(`Font "${font_name}" uploaded successfully`)
    } catch (error: any) {
      console.error('Failed to upload font', error)
      toast.error(error?.message || 'Failed to upload font')
    } finally {
      setIsFontUploading(false)
    }
  }
  const renderColorStep = (step: number) => (
    <div className=" overflow-y-auto hide-scrollbar h-[calc(90vh-200px)] pb-8"
      style={{
        paddingInline: step === 1 ? '20px' : '10px'
      }}
    >
      <Label className="flex text-xl font-medium text-[#191919] items-center gap-2 pb-5">

        {step === 1 ? 'Brand Colors' : 'Palette'}
        <RefreshCcw onClick={() => refeshTheme(step === 1 ? {

        } : {
          primary: customColors['primary'],
          background: customColors['background'],
        })} className='w-5 h-5 text-[#808080] hover:text-[#191919] duration-300 transition-all cursor-pointer' />
      </Label>
      <div className="space-y-4">


        <div>

          {step === 2 && <p className="text-xs text-[#4C4C4C] font-medium rounded-lg text-end pb-1.5">Brand Colors</p>}
          <div className="space-y-4"
            style={{
              padding: step === 2 ? '10px' : '0px',
              backgroundColor: step === 2 ? '#F9FAFB' : 'transparent'
            }}
          >
            <ColorPickerComponent
              colorKey="primary"
              label="Primary Color"
              currentColor={customColors['primary']}
              onColorChange={handleColorChange}
              showColorPicker={showColorPicker}
              onShowColorPicker={setShowColorPicker}
            />
            <ColorPickerComponent
              colorKey="background"
              label="Background Color"
              currentColor={customColors['background']}
              onColorChange={handleColorChange}
              showColorPicker={showColorPicker}
              onShowColorPicker={setShowColorPicker}
            />
          </div>
        </div>
        {step === 2 && <div>
          <p className="text-xs text-[#4C4C4C] font-medium text-end pb-1.5">Text Colors</p>
          <div className="space-y-4"
            style={{
              padding: step === 2 ? '10px' : '0px',
              backgroundColor: step === 2 ? '#F9FAFB' : 'transparent'
            }}
          >
            <ColorPickerComponent
              colorKey="background_text"
              label="Background Text"
              currentColor={customColors['background_text']}
              onColorChange={handleColorChange}
              showColorPicker={showColorPicker}
              onShowColorPicker={setShowColorPicker}
            />
            <ColorPickerComponent
              colorKey="primary_text"
              label="Primary Text"
              currentColor={customColors['primary_text']}
              onColorChange={handleColorChange}
              showColorPicker={showColorPicker}
              onShowColorPicker={setShowColorPicker}
            />
          </div>
        </div>}
        {step === 2 && <div className='px-2.5'>
          <ColorPickerComponent
            colorKey="card"
            label="Card Color"
            currentColor={customColors['card']}
            onColorChange={handleColorChange}
            showColorPicker={showColorPicker}
            onShowColorPicker={setShowColorPicker}
          />
        </div>}
        {step === 2 && <div>
          <p className="text-xs text-[#4C4C4C] font-medium text-end pb-1.5">Graph/Chart Colors</p>
          <div className="space-y-4"
            style={{
              padding: step === 2 ? '10px' : '0px',
              backgroundColor: step === 2 ? '#F9FAFB' : 'transparent'
            }}
          >
            <ColorPickerComponent
              colorKey="graph_0"
              label=""
              currentColor={customColors['graph_0']}
              onColorChange={handleColorChange}
              showColorPicker={showColorPicker}
              onShowColorPicker={setShowColorPicker}
            />
            <ColorPickerComponent
              colorKey="graph_1"
              label=""
              currentColor={customColors['graph_1']}
              onColorChange={handleColorChange}
              showColorPicker={showColorPicker}
              onShowColorPicker={setShowColorPicker}
            />
            <ColorPickerComponent
              colorKey="graph_2"
              label=""
              currentColor={customColors['graph_2']}
              onColorChange={handleColorChange}
              showColorPicker={showColorPicker}
              onShowColorPicker={setShowColorPicker}
            />
            <ColorPickerComponent
              colorKey="graph_3"
              label=""
              currentColor={customColors['graph_3']}
              onColorChange={handleColorChange}
              showColorPicker={showColorPicker}
              onShowColorPicker={setShowColorPicker}
            />
            <ColorPickerComponent
              colorKey="graph_4"
              label=""
              currentColor={customColors['graph_4']}
              onColorChange={handleColorChange}
              showColorPicker={showColorPicker}
              onShowColorPicker={setShowColorPicker}
            />
            <ColorPickerComponent
              colorKey="graph_5"
              label=""
              currentColor={customColors['graph_5']}
              onColorChange={handleColorChange}
              showColorPicker={showColorPicker}
              onShowColorPicker={setShowColorPicker}
            />
            <ColorPickerComponent
              colorKey="graph_6"
              label=""
              currentColor={customColors['graph_6']}
              onColorChange={handleColorChange}
              showColorPicker={showColorPicker}
              onShowColorPicker={setShowColorPicker}
            />
            <ColorPickerComponent
              colorKey="graph_7"
              label=""
              currentColor={customColors['graph_7']}
              onColorChange={handleColorChange}
              showColorPicker={showColorPicker}
              onShowColorPicker={setShowColorPicker}
            />
            <ColorPickerComponent
              colorKey="graph_8"
              label=""
              currentColor={customColors['graph_8']}
              onColorChange={handleColorChange}
              showColorPicker={showColorPicker}
              onShowColorPicker={setShowColorPicker}
            />
            <ColorPickerComponent
              colorKey="graph_9"
              label=""
              currentColor={customColors['graph_9']}
              onColorChange={handleColorChange}
              showColorPicker={showColorPicker}
              onShowColorPicker={setShowColorPicker}
            />

          </div>
        </div>}
      </div>


    </div>
  )

  const renderFontStep = () => (
    <div className="overflow-y-auto hide-scrollbar h-[calc(90vh-200px)] pb-8 space-y-5"
      style={{
        paddingInline: '10px'
      }}
    >
      <Label className="flex text-xl font-medium text-[#191919] items-center gap-2 px-2.5">
        Typography
      </Label>




      {/* Upload Custom Font */}
      <div className="px-2.5">
        <p className='text-xs text-[#4C4C4C] font-medium text-end pb-1.5'>Upload Custom Font</p>
        <div
          className={`p-3 rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer group
            ${isFontUploading
              ? 'bg-[#F8F7FF] border-[#7A5AF8]'
              : 'bg-[#F9FAFB] border-[#E0E0E0] '
            }`}
          onClick={() => {
            if (!isFontUploading) {
              document.getElementById('font-upload')?.click()
            }
          }}
          role="button"
          tabIndex={0}
        >
          {isFontUploading ? (
            <div className='flex items-center gap-3'>
              <div className='w-10 h-10 rounded-lg bg-[#EBE9FE] flex items-center justify-center'>
                <Loader2 className='w-5 h-5 text-[#7A5AF8] animate-spin' />
              </div>
              <div className='flex-1'>
                <p className='text-sm font-medium text-[#7A5AF8]'>Uploading font...</p>
                <p className='text-xs text-[#888]'>Please wait</p>
              </div>
            </div>
          ) : (
            <div className='flex items-center gap-3'>
              <div className='w-10 h-10 rounded-lg bg-[#EBE9FE] flex items-center justify-center group-hover:bg-[#DDD8FD] transition-colors'>
                <Plus className='w-5 h-5 text-[#7A5AF8]' />
              </div>
              <div className='flex-1'>
                <p className='text-sm font-medium text-[#151515]'>Upload Font File</p>
                <p className='text-xs text-[#888]'>.ttf, .otf, .woff, .woff2</p>
              </div>
              <ChevronRight className='w-4 h-4 text-[#999] group-hover:text-[#7A5AF8] transition-colors' />
            </div>
          )}
        </div>
        <input
          type="file"
          accept=".ttf,.otf,.woff,.woff2,.eot"
          className="w-full h-full hidden"
          id="font-upload"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (file) {
              await handleCustomFontChange(file)
            }
          }}
        />
      </div>

      {/* User's Uploaded Fonts */}
      {userFonts.fonts.length > 0 && (
        <div className="px-2.5">
          <p className='text-xs text-[#4C4C4C] font-medium text-end pb-1.5'>Your Uploaded Fonts</p>
          <div className='grid grid-cols-2 gap-2'>
            {userFonts.fonts?.map((font) => (
              <FontCard
                key={font.name}
                font={{
                  name: font.name,
                  displayName: font.name,
                }}
                isSelected={customFonts.textFont.name === font.name}
                onSelect={() => handleFontSelect(font.name, font.url)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Preset Fonts */}
      <div className='px-2.5'>
        <p className='text-xs text-[#4C4C4C] font-medium text-end pb-1.5'>Pre-Sets</p>
        <div className="grid grid-cols-2 gap-2 overflow-y-auto custom_scrollbar">
          {FONT_OPTIONS.map((font) => (
            <FontCard
              key={font.name}
              font={font}
              isSelected={customFonts.textFont.name === font.name}
              onSelect={() => handleFontSelect(font.name, font.cssUrl)}
            />
          ))}
        </div>
      </div>
    </div>
  )

  const renderLogoStep = () => (
    <div className="space-y-4 px-5">
      <Label className="flex text-xl font-medium text-[#191919] items-center gap-2">

        Logo
        {/* <RefreshCcw className='w-5 h-5 text-[#808080] hover:text-[#191919] duration-300 transition-all cursor-pointer' /> */}
      </Label>
      <div className="space-y-2">
        <Label className="flex text-base items-center gap-2">

          Company Name
        </Label>
        <Input
          defaultValue={themeCompanyName}
          placeholder="Enter company name"
          onBlur={(e) => setThemeCompanyName(e.target.value)}
        />
      </div>
      <Label className="flex text-base items-center gap-2">

        Brand Logo
      </Label>

      <div className="space-y-2 bg-[#F6F6F9] rounded-md p-1 cursor-pointer"
        onClick={(e) => {

          e.stopPropagation()
          document.getElementById('logo-upload')?.click()
        }}

        role="button"
        tabIndex={0}
      >

        <div className="border-2 border-dashed  border-gray-300 rounded-lg p-6 text-center">
          {isLogoUploading ? (
            <div className="flex flex-col items-center justify-center py-6 text-gray-500">
              <Loader2 className="h-6 w-6 animate-spin mb-2" />
              <p className="text-sm">Uploading logo...</p>
            </div>
          ) : customBrandLogo ? (
            <div className="space-y-2">
              <img
                src={customBrandLogo}
                alt="Brand Logo"
                className="mx-auto h-16 w-auto object-contain"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedTheme({ ...selectedTheme, logo_url: '' })
                  setCustomBrandLogo('')
                  setCustomBrandLogoId('')
                }}
              >
                Remove Logo
              </Button>
            </div>
          ) : (
            <>
              <div className='w-[42px] h-[42px] mx-auto flex justify-center items-center rounded-full bg-[#EBE9FE]' >
                <div className='w-[22px] h-[22px] rounded-full bg-[#7A5AF8] flex items-center justify-center text-white'>
                  <Plus className='w-3 h-3' />
                </div>
              </div>
              <div className="mt-2">
                <label htmlFor="logo-upload" className="cursor-pointer">
                  <span className="text-blue-600 hover:text-blue-500">Click to upload</span>
                  <span className="text-gray-500"> or drag and drop</span>
                </label>
                <input
                  id="logo-upload"
                  type="file"
                  accept="image/png, image/jpeg, image/jpg"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      await handleBrandLogoUpload(file)
                    }
                  }}
                />
              </div>

            </>
          )}
        </div>
      </div>
    </div>
  )


  // LOOK for new-theme in the url
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'new-theme') {
      createNewCustomTheme()

    }
  }, [searchParams])


  return (
    <div className="space-y-6 px-6 font-syne">
      <div className='py-[28px] flex justify-between'>

        <h3 className=" text-[28px]  tracking-[-0.84px] font-unbounded font-normal text-[#101828] flex items-center gap-2">
          Themes
        </h3>
        <Link
          href="/theme?tab=new-theme"
          onClick={() => trackEvent(MixpanelEvent.Theme_New_Theme_Clicked, {
            pathname,
            source: "theme_page_header",
          })}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-black text-sm font-semibold font-syne shadow-sm hover:shadow-md"
          aria-label="Create new theme"
          style={{
            borderRadius: "48px",
            background: "linear-gradient(270deg, #D5CAFC 2.4%, #E3D2EB 27.88%, #F4DCD3 69.23%, #FDE4C2 100%)",
          }}
        >

          <span className="hidden md:inline">New Theme</span>
          <span className="md:hidden">New</span>
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
      {/* Tabs */}
      <div className='p-1 rounded-[40px] bg-[#F7F6F9] w-fit border border-[#F4F4F4] flex items-center justify-center '>
        <button className='px-5  py-2 text-xs font-medium text-[#3A3A3A] rounded-[70px]'
          onClick={() => {
            trackEvent(MixpanelEvent.Theme_Tab_Switched, { pathname, tab: 'custom' })
            setTab('custom')
          }}
          style={{
            background: tab === 'custom' ? 'linear-gradient(270deg, #D5CAFC 2.4%, #E3D2EB 27.88%, #F4DCD3 69.23%, #FDE4C2 100%)' : 'transparent'
          }}
        >Custom</button>
        <svg xmlns="http://www.w3.org/2000/svg" className='mx-1' width="2" height="17" viewBox="0 0 2 17" fill="none">
          <path d="M1 0V16.5" stroke="#EDECEC" strokeWidth="2" />
        </svg>
        <button className='px-5  py-2 text-xs font-medium text-[#3A3A3A] rounded-[70px]'
          onClick={() => {
            trackEvent(MixpanelEvent.Theme_Tab_Switched, { pathname, tab: 'default' })
            setTab('default')
          }}
          style={{
            background: tab === 'default' ? 'linear-gradient(270deg, #D5CAFC 2.4%, #E3D2EB 27.88%, #F4DCD3 69.23%, #FDE4C2 100%)' : 'transparent'
          }}
        >Built-in</button>
      </div>
      {/* Built-in Themes */}

      {tab === 'default' && <div className="flex flex-wrap gap-6">
        {
          defaultThemes.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              onDelete={handleDelete}
              onSelect={handleThemeSelect}
              showDeleteButton={false}
            />
          ))
        }


      </div>}
      {/* Custom Themes Section */}
      {tab === 'custom' && customThemes.length > 0 && (

        <div className="flex flex-wrap gap-6">
          {customThemes.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              onDelete={handleDelete}
              onSelect={handleThemeSelect}
            />
          ))}
        </div>

      )}

      {tab === 'custom' && customThemes.length === 0 && (
        <CustomTabEmpty />
      )}

      {/* Theme Editor Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={handleCloseSheet} >


        <SheetContent side="bottom" className="h-[90vh] font-syne w-full p-0 [&>button]:hidden focus:outline-none" >
          <div className="flex h-full">
            {/* Left side - Editor */}
            <div
              onClick={handleClickOutside}
              className="min-w-[530px]   border-r border-[#EDEEEF]">
              <div className="flex items-center justify-between px-5 rounded-md py-3 mx-2.5 my-2.5 bg-[#F6F6F9]  ">
                <input id="theme-name" name="theme-name" className="text-lg font-semibold text-[#4C4D50] bg-transparent w-full outline-none border-none px-2  rounded" autoFocus={false} defaultValue={selectedTheme.name} onBlur={(e) => setSelectedTheme({ ...selectedTheme, name: e.target.value })}>

                </input>
                <SquarePen className='w-4 h-4  text-[#808080] hover:text-[#4C4D50] cursor-pointer' onClick={() => {
                  document.getElementById('theme-name')?.focus()
                }} />
              </div>
              <div className='flex h-full   border-t border-[#EDEEEF] '>
                <StepIndicator currentStep={currentStep} />
                <div className='pt-7  w-full  h-[calc(90vh-120px)] flex flex-col justify-between  '>
                  {currentStep === 1 && renderColorStep(currentStep)}
                  {currentStep === 2 && renderColorStep(currentStep)}
                  {currentStep === 3 && renderFontStep()}
                  {currentStep === 4 && renderLogoStep()}


                  <div className='border-t border-[#EDEEEF] py-6 '>
                    <div className='flex justify-end px-5 gap-2'>
                      {currentStep > 1 && <button

                        className='px-3.5 py-2.5 bg-[#F7F6F9] rounded-[48px] text-xs font-semibold text-[#101323]'
                        onClick={() => setCurrentStep(currentStep - 1)}
                      >Back</button>}

                      <button className='px-7 py-2.5 flex items-center gap-1 rounded-[48px] text-xs font-semibold text-[#101323] '

                        onClick={() => {
                          if (currentStep === 4) {
                            saveAsCustom()
                          }
                          else if (currentStep === 1) {
                            setCurrentStep(currentStep + 1)
                            if (isNewTheme) {

                              refeshTheme({
                                primary: customColors['primary'],
                                background: customColors['background'],
                              })
                            }
                          }
                          else {
                            setCurrentStep(currentStep + 1)
                          }
                        }}
                        style={{
                          background: 'linear-gradient(270deg, #D5CAFC 2.4%, #E3D2EB 27.88%, #F4DCD3 69.23%, #FDE4C2 100%)'
                        }}
                      >
                        {currentStep === 1 ? 'Generate theme palette' : currentStep === 2 ? 'Continue to Fonts' : currentStep === 3 ? 'Continue to Design' : 'Save as Custom Theme'}
                        <ChevronRight className='w-4 h-4' />
                      </button>
                    </div>
                  </div>
                </div>


              </div>
            </div>




            {/* Right side - Live Preview */}
            <div
              ref={(el) => {
                // don't assign to .current to avoid readonly error; just apply when available
                if (el) {
                  (previewContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = el
                  const updatedTheme: Theme = {
                    ...selectedTheme,
                    logo_url: customBrandLogo || selectedTheme.logo_url,
                    data: {
                      ...selectedTheme.data,
                      colors: customColors,
                      fonts: customFonts,
                    },
                  }
                  applyTheme(updatedTheme)
                  setSlideContainerWidth(slideContainerRef.current?.clientWidth || 0)
                }
              }}
              // ref={previewContainerRef}
              className=" w-full p-3 bg-gray-50">
              <div className="space-y-4">
                <div
                  ref={slideContainerRef}
                  style={{ backgroundColor: 'var(--page-background-color)' }}
                  className="overflow-y-auto overflow-x-hidden custom_scrollbar space-y-4 h-[90vh] rounded-lg shadow-lg border bg-white"
                >
                  {template && template.map((layout) => {
                    const {
                      component: LayoutComponent,
                      sampleData,

                    } = layout;
                    return (
                      <div key={layout.layoutId}>
                        <div
                          className="relative w-full"
                          style={{ height: `${720 * slideScale()}px` }}
                        >
                          <div
                            className="absolute top-0 left-0 pointer-events-none"
                            style={{
                              width: 1280,
                              height: 720,
                              transformOrigin: "top left",
                              transform: `scale(${slideScale()})`,
                            }}
                          >
                            <LayoutComponent data={sampleData} />
                          </div>
                        </div>

                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>


    </div>
  )
}

export default ThemePanel

// No mapping helpers needed: using unified API Theme type everywhere
