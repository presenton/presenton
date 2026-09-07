export const loadGoogleFont = (fontFamily: string) => {
  // Check if font is already loaded
  const existingLink = document.querySelector(`link[href*="${fontFamily.replace(' ', '+')}"]`)
  if (existingLink) return
  
  const link = document.createElement('link')
  link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(' ', '+')}:wght@300;400;500;600;700&display=swap`
  link.rel = 'stylesheet'
  document.head.appendChild(link)
}
