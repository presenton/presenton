import os
import uuid
import shutil
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, File, UploadFile
from pydantic import BaseModel
from templates.preview import FontCheckResponse, check_fonts_in_pptx_handler
from utils.asset_directory_utils import get_app_data_directory_env

try:
    from fontTools.ttLib import TTFont
    from fontTools.ttLib.tables._n_a_m_e import table__n_a_m_e
    FONTTOOLS_AVAILABLE = True
except ImportError:
    FONTTOOLS_AVAILABLE = False

FONTS_ROUTER = APIRouter(prefix="/fonts", tags=["fonts"])

# Supported font file extensions
SUPPORTED_FONT_EXTENSIONS = {
    '.ttf': 'font/ttf',
    '.otf': 'font/otf', 
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.eot': 'application/vnd.ms-fontobject'
}

class FontUploadResponse(BaseModel):
    success: bool
    font_name: str
    font_url: str
    font_path: str
    message: Optional[str] = None

class FontListResponse(BaseModel):
    success: bool
    fonts: List[dict]
    message: Optional[str] = None


class UploadedFontsResponse(BaseModel):
    fonts: List[dict]


def get_fonts_directory() -> str:
    """Get the fonts directory path, create if it doesn't exist"""
    app_data_dir = get_app_data_directory_env() or "/tmp/presenton"
    fonts_dir = os.path.join(app_data_dir, "fonts")
    os.makedirs(fonts_dir, exist_ok=True)
    return fonts_dir


def is_valid_font_file(file: UploadFile) -> bool:
    """Validate font file by extension and MIME type"""
    if not file.filename:
        return False
    
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in SUPPORTED_FONT_EXTENSIONS:
        return False
    
    # Check MIME type
    content_type = file.content_type or ""
    valid_mime_types = [
        "font/ttf", "font/otf", "font/woff", "font/woff2",
        "application/font-ttf", "application/font-otf", 
        "application/font-woff", "application/font-woff2",
        "application/x-font-ttf", "application/x-font-otf",
        "font/truetype", "font/opentype"
    ]
    
    return content_type in valid_mime_types


def extract_font_name_from_file(file_path: str) -> str:
    """Extract the actual font family name from font file metadata"""
    if not FONTTOOLS_AVAILABLE:
        # Fallback to filename parsing if fonttools not available
        filename = os.path.basename(file_path)
        base_name = os.path.splitext(filename)[0]
        if '_' in filename and len(filename.split('_')[-1].split('.')[0]) == 8:
            # Remove UUID part
            parts = filename.split('_')
            if len(parts) > 1:
                return '_'.join(parts[:-1])
        return base_name
    
    try:
        font = TTFont(file_path)
        
        # Try to get font family name from name table
        if 'name' in font:
            name_table = font['name']
            
            # Preferred order: Family name (ID 1), then Full name (ID 4), then PostScript name (ID 6)
            for name_id in [1, 4, 6]:
                for record in name_table.names:
                    if record.nameID == name_id:
                        # Prefer English names
                        if record.langID == 0x409 or record.langID == 0:  # English
                            font_name = record.toUnicode().strip()
                            if font_name:
                                font.close()
                                return font_name
            
            # If no English name found, use any available family name
            for record in name_table.names:
                if record.nameID == 1:  # Family name
                    font_name = record.toUnicode().strip()
                    if font_name:
                        font.close()
                        return font_name
        
        font.close()
    except Exception as e:
        # If font parsing fails, fallback to filename
        print(f"Error reading font metadata from {file_path}: {e}")
    
    # Fallback to filename parsing
    filename = os.path.basename(file_path)
    base_name = os.path.splitext(filename)[0]
    if '_' in filename and len(filename.split('_')[-1].split('.')[0]) == 8:
        # Remove UUID part
        parts = filename.split('_')
        if len(parts) > 1:
            return '_'.join(parts[:-1])
    return base_name


@FONTS_ROUTER.post("/upload", response_model=FontUploadResponse)
async def upload_font(
    font_file: UploadFile = File(..., description="Font file to upload (.ttf, .otf, .woff, .woff2, .eot)")
):
    """
    Upload a font file and save it to the fonts directory.
    
    Args:
        font_file: Uploaded font file
    
    Returns:
        FontUploadResponse with font details and accessible URL
    
    Raises:
        HTTPException: If file validation fails or upload error occurs
    """
    try:
        # Validate file
        if not font_file.filename:
            raise HTTPException(
                status_code=400,
                detail="No file name provided"
            )
        
        if not is_valid_font_file(font_file):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid font file. Supported formats: {', '.join(SUPPORTED_FONT_EXTENSIONS.keys())}"
            )
        
        # Generate unique filename to avoid conflicts
        file_ext = os.path.splitext(font_file.filename)[1].lower()
        base_name = os.path.splitext(font_file.filename)[0]
        unique_filename = f"{base_name}_{str(uuid.uuid4())[:8]}{file_ext}"
        
        # Get fonts directory
        fonts_dir = get_fonts_directory()
        font_path = os.path.join(fonts_dir, unique_filename)
        
        # Save the uploaded file
        with open(font_path, "wb") as buffer:
            shutil.copyfileobj(font_file.file, buffer)
        
        # Generate accessible URL
        font_url = f"/app_data/fonts/{unique_filename}"
        
        return FontUploadResponse(
            success=True,
            font_name=base_name,
            font_url=font_url,
            font_path=font_path,
            message=f"Font '{base_name}' uploaded successfully"
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        print(f"Error uploading font: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error uploading font: {str(e)}"
        )


@FONTS_ROUTER.get("/list", response_model=FontListResponse)
async def list_fonts():
    """
    List all uploaded fonts with their accessible URLs.
    
    Returns:
        FontListResponse with list of available fonts
    """
    try:
        fonts_dir = get_fonts_directory()
        fonts = []
        
        # Get all font files in the directory
        if os.path.exists(fonts_dir):
            for filename in os.listdir(fonts_dir):
                file_path = os.path.join(fonts_dir, filename)
                
                if os.path.isfile(file_path):
                    file_ext = os.path.splitext(filename)[1].lower()
                    
                    if file_ext in SUPPORTED_FONT_EXTENSIONS:
                        # Get the real font name from file metadata
                        font_name = extract_font_name_from_file(file_path)
                        
                        # Extract original name (remove UUID suffix for display)
                        base_name = filename
                        if '_' in filename and len(filename.split('_')[-1].split('.')[0]) == 8:
                            # Remove UUID part for original_name display
                            parts = filename.split('_')
                            if len(parts) > 1:
                                base_name = '_'.join(parts[:-1]) + file_ext
                        
                        fonts.append({
                            "filename": filename,
                            "font_name": font_name,  # Real font family name from metadata
                            "original_name": base_name,
                            "font_url": f"/app_data/fonts/{filename}",
                            "font_type": SUPPORTED_FONT_EXTENSIONS.get(file_ext, 'unknown'),
                            "file_size": os.path.getsize(file_path)
                        })
        
        return FontListResponse(
            success=True,
            fonts=fonts,
            message=f"Found {len(fonts)} font files"
        )
        
    except Exception as e:
        print(f"Error listing fonts: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error listing fonts: {str(e)}"
        )


@FONTS_ROUTER.get("/uploaded", response_model=UploadedFontsResponse)
async def get_uploaded_fonts():
    """
    Compatibility endpoint used by frontend theme flow.
    Returns uploaded fonts as a compact list with id/name/url fields.
    """
    try:
        fonts_dir = get_fonts_directory()
        fonts = []

        if os.path.exists(fonts_dir):
            for filename in os.listdir(fonts_dir):
                file_path = os.path.join(fonts_dir, filename)
                if not os.path.isfile(file_path):
                    continue

                file_ext = os.path.splitext(filename)[1].lower()
                if file_ext not in SUPPORTED_FONT_EXTENSIONS:
                    continue

                font_name = extract_font_name_from_file(file_path)
                fonts.append(
                    {
                        "id": filename,
                        "name": font_name,
                        "url": f"/app_data/fonts/{filename}",
                    }
                )

        return UploadedFontsResponse(fonts=fonts)

    except Exception as e:
        print(f"Error getting uploaded fonts: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error getting uploaded fonts: {str(e)}"
        )


FONTS_ROUTER.post("/check", response_model=FontCheckResponse)(check_fonts_in_pptx_handler)


@FONTS_ROUTER.delete("/delete/{filename}")
async def delete_font(filename: str):
    """
    Delete a font file from the fonts directory.
    
    Args:
        filename: Name of the font file to delete
    
    Returns:
        Success message
    """
    try:
        fonts_dir = get_fonts_directory()
        font_path = os.path.join(fonts_dir, filename)
        
        if not os.path.exists(font_path):
            raise HTTPException(
                status_code=404,
                detail=f"Font file '{filename}' not found"
            )
        
        # Validate it's actually a font file before deleting
        file_ext = os.path.splitext(filename.lower())[1]
        if file_ext not in SUPPORTED_FONT_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail="File is not a recognized font format"
            )
        
        os.remove(font_path)
        
        return {
            "success": True,
            "message": f"Font '{filename}' deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting font: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error deleting font: {str(e)}"
        ) 
