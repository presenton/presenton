export interface UploadedFile {
  id: string;
  file: File;
  size: string;
}
export enum ThemeType {
  Light = "light",
  Dark = "dark",
  Custom = "custom",
  Faint_Yellow = "faint_yellow",
  Royal_Blue = "royal_blue",
  Light_Red = "light_red",
  Dark_Pink = "dark_pink",
}

export enum LanguageType {
  // Major World Languages
  //   Auto = "Auto",
  English = "English",
  Spanish = "Spanish (Español)",
  French = "French (Français)",
  German = "German (Deutsch)",
  Portuguese = "Portuguese (Português)",
  Italian = "Italian (Italiano)",
  Dutch = "Dutch (Nederlands)",
  Russian = "Russian (Русский)",
  ChineseSimplified = "Chinese (Simplified - 中文, 汉语)",
  ChineseTraditional = "Chinese (Traditional - 中文, 漢語)",
  Japanese = "Japanese (日本語)",
  Korean = "Korean (한국어)",
  Arabic = "Arabic (العربية)",
  Hindi = "Hindi (हिन्दी)",
  Bengali = "Bengali (বাংলা)",

  // European Languages
  Polish = "Polish (Polski)",
  Czech = "Czech (Čeština)",
  Slovak = "Slovak (Slovenčina)",
  Hungarian = "Hungarian (Magyar)",
  Romanian = "Romanian (Română)",
  Bulgarian = "Bulgarian (Български)",
  Greek = "Greek (Ελληνικά)",
  Serbian = "Serbian (Српски / Srpski)",
  Croatian = "Croatian (Hrvatski)",
  Bosnian = "Bosnian (Bosanski)",
  Slovenian = "Slovenian (Slovenščina)",
  Finnish = "Finnish (Suomi)",
  Swedish = "Swedish (Svenska)",
  Danish = "Danish (Dansk)",
  Norwegian = "Norwegian (Norsk)",
  Icelandic = "Icelandic (Íslenska)",
  Lithuanian = "Lithuanian (Lietuvių)",
  Latvian = "Latvian (Latviešu)",
  Estonian = "Estonian (Eesti)",
  Maltese = "Maltese (Malti)",
  Welsh = "Welsh (Cymraeg)",
  Irish = "Irish (Gaeilge)",
  ScottishGaelic = "Scottish Gaelic (Gàidhlig)",
  Ukrainian = "Ukrainian (Українська)",

  // Middle Eastern and Central Asian Languages
  Hebrew = "Hebrew (עברית)",
  Persian = "Persian/Farsi (فارسی)",
  Turkish = "Turkish (Türkçe)",
  Kurdish = "Kurdish (Kurdî / کوردی)",
  Pashto = "Pashto (پښتو)",
  Dari = "Dari (دری)",
  Uzbek = "Uzbek (Oʻzbek)",
  Kazakh = "Kazakh (Қазақша)",
  Tajik = "Tajik (Тоҷикӣ)",
  Turkmen = "Turkmen (Türkmençe)",
  Azerbaijani = "Azerbaijani (Azərbaycan dili)",

  // South Asian Languages
  Urdu = "Urdu (اردو)",
  Tamil = "Tamil (தமிழ்)",
  Telugu = "Telugu (తెలుగు)",
  Marathi = "Marathi (मराठी)",
  Punjabi = "Punjabi (ਪੰਜਾਬੀ / پنجابی)",
  Gujarati = "Gujarati (ગુજરાતી)",
  Malayalam = "Malayalam (മലയാളം)",
  Kannada = "Kannada (ಕನ್ನಡ)",
  Odia = "Odia (ଓଡ଼ିଆ)",
  Sinhala = "Sinhala (සිංහල)",
  Nepali = "Nepali (नेपाली)",

  // East and Southeast Asian Languages
  Thai = "Thai (ไทย)",
  Vietnamese = "Vietnamese (Tiếng Việt)",
  Lao = "Lao (ລາວ)",
  Khmer = "Khmer (ភាសាខ្មែរ)",
  Burmese = "Burmese (မြန်မာစာ)",
  Tagalog = "Tagalog/Filipino (Tagalog/Filipino)",
  Javanese = "Javanese (Basa Jawa)",
  Sundanese = "Sundanese (Basa Sunda)",
  Malay = "Malay (Bahasa Melayu)",
  Mongolian = "Mongolian (Монгол)",

  // African Languages
  Swahili = "Swahili (Kiswahili)",
  Hausa = "Hausa (Hausa)",
  Yoruba = "Yoruba (Yorùbá)",
  Igbo = "Igbo (Igbo)",
  Amharic = "Amharic (አማርኛ)",
  Zulu = "Zulu (isiZulu)",
  Xhosa = "Xhosa (isiXhosa)",
  Shona = "Shona (ChiShona)",
  Somali = "Somali (Soomaaliga)",

  // Indigenous and Lesser-Known Languages
  Basque = "Basque (Euskara)",
  Catalan = "Catalan (Català)",
  Galician = "Galician (Galego)",
  Quechua = "Quechua (Runasimi)",
  Nahuatl = "Nahuatl (Nāhuatl)",
  Hawaiian = "Hawaiian (ʻŌlelo Hawaiʻi)",
  Maori = "Maori (Te Reo Māori)",
  Tahitian = "Tahitian (Reo Tahiti)",
  Samoan = "Samoan (Gagana Samoa)",
}

export interface PresentationConfig {
  slides: string | null;
  language: LanguageType | null;
  prompt: string;
  tone: ToneType;
  verbosity: VerbosityType;
  instructions: string;
  includeTableOfContents: boolean;
  includeTitleSlide: boolean;
  webSearch: boolean;
}

export enum ToneType {
  Default = "default",
  Casual = "casual",
  Professional = "professional",
  Funny = "funny",
  Educational = "educational",
  Sales_Pitch = "sales_pitch",
}

export enum VerbosityType {
  Concise = "concise",
  Standard = "standard",
  Text_Heavy = "text-heavy",
}

