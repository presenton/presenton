
export interface LayoutInfo {
    name: string
    component: React.ComponentType<any>
    schema: any
    sampleData: any
    fileName: string
    templateID: string
    layoutId: string
}

export interface TemplateSetting {
    description: string;
    ordered: boolean;
    default?: boolean;
    icon_type?: string;
    icon_weight?: string;
}

export interface TemplateResponse {
    templateID: string
    templateName?: string
    layouts: LayoutInfo[]
    settings: TemplateSetting | null
}

export interface TemplateResponse {
    templateName?: string
    templateID: string
    files: string[],
    settings: TemplateSetting | null
}

export interface LoadingState {
    loading: boolean
    error: string | null
}

export interface NavigationState {
    currentLayout: number
    totalLayouts: number
}

export type LoadingStateType = 'loading' | 'error' | 'empty'

export interface ComponentProps {
    className?: string
    children?: React.ReactNode
}
