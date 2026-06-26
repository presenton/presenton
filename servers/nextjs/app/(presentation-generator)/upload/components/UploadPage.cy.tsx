import React from 'react'
import UploadPage from './UploadPage'
import { mount } from 'cypress/react'
import { store } from '@/store/store'
import { Provider } from 'react-redux'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'

// Import global styles
import '@/app/globals.css'

// Create a mock router
const createRouter = (push = cy.stub().as('router.push')) => ({
  push,
  back: cy.stub(),
  forward: cy.stub(),
  refresh: cy.stub(),
  replace: cy.stub(),
  prefetch: cy.stub(),
  route: '/',
  pathname: '/',
  query: {},
  asPath: '/',
})

interface RouterWrapperProps {
  children: React.ReactNode;
}

// Custom mount command with Redux Provider and Next.js Router
Cypress.Commands.add('mount', (component, options = {}) => {
  const router = createRouter()
  const RouterWrapper = ({ children }: RouterWrapperProps) => (
    <AppRouterContext.Provider value={router}>
      <Provider store={store}>
        {children}
      </Provider>
    </AppRouterContext.Provider>
  )

  return mount(
    <RouterWrapper>
      {component}
    </RouterWrapper>,
    options
  )
})

// Helper function to check for toast message
const checkToast = (message: string) => {
  // Wait for toast to appear and check its content
  cy.get('[role="status"]', { timeout: 5000 })
    .should('exist')
    .and('contain', message)
}

describe('<UploadPage />', () => {
  beforeEach(() => {
    // Set viewport size
    cy.viewport(1440, 900)

    // Reset any previous interceptions
    cy.intercept('POST', '**/ppt/generate*', {
      statusCode: 200,
      body: { id: 'test-id' }
    }).as('createPresentation')

    cy.intercept('POST', '**/ppt/titles/generate*', {
      statusCode: 200,
      body: { id: 'test-id', titles: ['Title 1', 'Title 2'] }
    }).as('generateTitles')

    cy.intercept('POST', '**/ppt/create', {
      statusCode: 200,
      body: { id: 'test-id' }
    }).as('getQuestions')

    cy.mount(<UploadPage />)
  })

  describe('Configuration Selection', () => {
    it('should allow selecting number of slides', () => {
      // Force click to handle any overlay issues
      cy.get('[data-testid="slides-select"]').click({ force: true })
      // Wait for content to be visible
      cy.get('[role="option"]').should('be.visible')
      // Click the option
      cy.get('[role="option"]').contains('12').click()
      // Verify selection
      cy.get('[data-testid="slides-select"]').should('contain', '12')
    })

    it('should allow replacing a custom slide count with a preset', () => {
      cy.get('[data-testid="slides-select"]').click({ force: true })
      cy.get('input[placeholder="--"]').clear().type('50{enter}')
      cy.get('[data-testid="slides-select"]').should('contain', '50')

      cy.get('[data-testid="slides-select"]').click({ force: true })
      cy.get('input[placeholder="--"]').focus().should('have.value', '50')
      cy.get('[role="option"]').contains('12 slides').click()

      cy.get('[data-testid="slides-select"]').should('contain', '12')
      cy.get('[data-testid="slides-select"]').should('not.contain', '50')
    })

    it('should allow selecting language', () => {
      // Force click to handle any overlay issues
      cy.get('[data-testid="language-select"]').click({ force: true })
      // Wait for content to be visible and click Simplified Chinese
      cy.get('[role="option"]').contains('Chinese (Simplified - 中文, 汉语)').should('be.visible').click()
      // Verify selection
      cy.get('[data-testid="language-select"]').should('contain', 'Chinese (Simplified - 中文, 汉语)')

      // Now test Traditional Chinese as well
      cy.get('[data-testid="language-select"]').click({ force: true })
      cy.get('[role="option"]').contains('Chinese (Traditional - 中文, 漢語)').should('be.visible').click()
      cy.get('[data-testid="language-select"]').should('contain', 'Chinese (Traditional - 中文, 漢語)')
    })
  })

  describe('Prompt Input', () => {
    it('should allow entering prompt text', () => {
      const testPrompt = 'Create a presentation about AI'
      cy.get('[data-testid="prompt-input"]').type(testPrompt)
      cy.get('[data-testid="prompt-input"]').should('have.value', testPrompt)
    })

    it('should toggle research mode', () => {
      cy.get('[data-testid="research-mode-switch"]').click()
      cy.get('[data-testid="research-mode-switch"]').should('have.attr', 'aria-checked', 'true')
    })
  })

  describe('File Upload', () => {
    it('should handle document uploads', () => {
      cy.fixture('example.txt').as('testFile')
      cy.get('[data-testid="file-upload-input"]').selectFile('@testFile', { force: true })
      cy.contains('example.txt').should('exist')
      // Check for success toast
      checkToast('Files selected')
    })
  })
  describe('File Handling', () => {
    beforeEach(() => {
      // Create a text file fixture
      cy.writeFile('cypress/fixtures/test-doc.txt', 'Test content')
    })

    it('should handle multiple document uploads', () => {
      // Create two files with different names
      const file1 = new File(['content1'], 'document1.txt', { type: 'text/plain' })
      const file2 = new File(['content2'], 'document2.txt', { type: 'text/plain' })

      // Upload multiple files
      cy.get('[data-testid="file-upload-input"]')
        .selectFile([
          { contents: file1, fileName: 'document1.txt' },
          { contents: file2, fileName: 'document2.txt' }
        ], { force: true })

      // Verify files are listed
      cy.get('[data-testid="file-list"]').within(() => {
        cy.contains('document1.txt').should('be.visible')
        cy.contains('document2.txt').should('be.visible')
      })
      checkToast('Files selected')
    })

    it('should handle image uploads', () => {
      // Create an image file
      const imageFile = new File(['image content'], 'test-image.jpg', { type: 'image/jpeg' })

      cy.get('[data-testid="file-upload-input"]')
        .selectFile({
          contents: imageFile,
          fileName: 'test-image.jpg',
          mimeType: 'image/jpeg'
        }, { force: true })

      // Verify image is listed
      cy.get('[data-testid="file-list"]').within(() => {
        cy.contains('test-image.jpg').should('be.visible')
      })
      checkToast('Files selected')
    })

    it('should handle mixed document and image uploads', () => {
      // Create document and image files
      const docFile = new File(['doc content'], 'test-doc.txt', { type: 'text/plain' })
      const imageFile = new File(['image content'], 'test-image.jpg', { type: 'image/jpeg' })

      cy.get('[data-testid="file-upload-input"]')
        .selectFile([
          { contents: docFile, fileName: 'test-doc.txt' },
          { contents: imageFile, fileName: 'test-image.jpg', mimeType: 'image/jpeg' }
        ], { force: true })

      // Verify both files are listed
      cy.get('[data-testid="file-list"]').within(() => {
        cy.contains('test-doc.txt').should('be.visible')
        cy.contains('test-image.jpg').should('be.visible')
      })
      checkToast('Files selected')
    })
  })

  describe('Validation', () => {
    it('should show error when no prompt or documents provided', () => {
      // Click next without entering prompt or uploading files
      cy.contains('button', 'Next').click()
      // Check for error toast
      checkToast('No Prompt or Document Provided')
    })
    it('should show error when no prompt provided but research mode is on', () => {
      cy.get('[data-testid="research-mode-switch"]').click({ force: true })
      cy.get('[data-testid="research-mode-switch"]').should('have.attr', 'aria-checked', 'true')
      cy.contains('button', 'Next').click()
      checkToast('No Prompt or Document Provided')
    })
  })

  describe('Generation Flow', () => {
    it('should proceed to theme page with prompt-only configuration', () => {
      // Enter prompt
      cy.get('[data-testid="prompt-input"]').type('Create a presentation about AI')

      // Click generate
      cy.contains('button', 'Next').click()

      // Wait for API calls with longer timeout
      cy.wait('@getQuestions', { timeout: 10000 })
      cy.wait('@generateTitles', { timeout: 10000 })

      // Verify navigation to theme page
      cy.get('@router.push').should('be.calledWith', '/theme')
    })

    it('should proceed to documents-preview with research mode', () => {
      // Enable research mode
      cy.get('[data-testid="research-mode-switch"]').click({ force: true })

      // Enter prompt
      cy.get('[data-testid="prompt-input"]').type('Research about AI technology')

      // Intercept research report generation
      cy.intercept('POST', '**/ppt/report/generate', {
        statusCode: 200,
        body: { content: 'Research report content' }
      }).as('researchReport')

      // Click generate
      cy.contains('button', 'Next').click()

      // Wait for research API call
      cy.wait('@researchReport', { timeout: 10000 })

      // Verify navigation to documents-preview page
      cy.get('@router.push').should('be.calledWith', '/documents-preview')
    })

    it('should proceed to documents-preview with uploaded document', () => {
      // Upload a document
      cy.fixture('example.txt').as('testFile')
      cy.get('[data-testid="file-upload-input"]').selectFile('@testFile', { force: true })

      // Enter prompt
      cy.get('[data-testid="prompt-input"]').type('Analyze this document')

      // Intercept document upload and decomposition
      cy.intercept('POST', '**/ppt/files/upload', {
        statusCode: 200,
        body: {
          documents: ['doc1'],
          images: []
        }
      }).as('uploadDoc')

      cy.intercept('POST', '**/ppt/files/decompose', {
        statusCode: 200,
        body: {
          documents: { doc1: 'content' },
          images: {},
          charts: {},
          tables: {}
        }
      }).as('decomposeDoc')

      // Click generate
      cy.contains('button', 'Next').click()

      // Wait for upload and decompose API calls
      cy.wait('@uploadDoc', { timeout: 10000 })
      cy.wait('@decomposeDoc', { timeout: 10000 })

      // Verify navigation to documents-preview page
      cy.get('@router.push').should('be.calledWith', '/documents-preview')
    })
  })

  describe('Error Handling', () => {
    it('should handle API errors gracefully', () => {
      // Setup API to return error
      cy.intercept('POST', '**/ppt/create', {
        statusCode: 500,
        body: { error: 'Internal Server Error' }
      }).as('apiError')

      // Enter prompt and try to generate
      cy.get('[data-testid="prompt-input"]').type('Test presentation')
      cy.contains('button', 'Next').click()

      // Check for error toast
      checkToast('Failed to generate presentation')
    })
  })
})
