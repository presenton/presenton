import uuid

from fastapi import APIRouter

from templates.handler import (
    CreateSlideLayoutResponse,
    EditSlideLayoutResponse,
    EditSlideLayoutSectionResponse,
    FontsUploadAndSlidesPreviewResponse,
    GetTemplateLayoutsResponse,
    PresentationLayoutModel,
    SaveTemplateLayoutData,
    SaveTemplateResponse,
    TemplateDetail,
    TemplateExample,
    clone_slide_layout,
    clone_template,
    create_slide_layout,
    edit_slide_layout,
    edit_slide_layout_section,
    get_all_templates,
    get_layouts,
    get_template_by_id,
    get_template_example,
    init_create_template,
    save_slide_layout,
    save_template,
    update_template,
    upload_fonts_and_slides_preview,
)

TEMPLATE_ROUTER = APIRouter(prefix="/template", tags=["Template"])

TEMPLATE_ROUTER.get("/all", response_model=list[TemplateDetail])(get_all_templates)
TEMPLATE_ROUTER.get(
    "/{template_id}/layouts", response_model=GetTemplateLayoutsResponse
)(get_layouts)
TEMPLATE_ROUTER.get("/{id}", response_model=PresentationLayoutModel)(get_template_by_id)
TEMPLATE_ROUTER.get("/{id}/example", response_model=TemplateExample)(
    get_template_example
)
TEMPLATE_ROUTER.post(
    "/fonts-upload-and-slides-preview",
    response_model=FontsUploadAndSlidesPreviewResponse,
)(upload_fonts_and_slides_preview)
TEMPLATE_ROUTER.post("/create/init", response_model=uuid.UUID)(init_create_template)
TEMPLATE_ROUTER.post("/slide-layout/create", response_model=CreateSlideLayoutResponse)(
    create_slide_layout
)
TEMPLATE_ROUTER.post("/create/slide-layout", response_model=CreateSlideLayoutResponse)(
    create_slide_layout
)
TEMPLATE_ROUTER.post("/slide-layout/edit", response_model=EditSlideLayoutResponse)(
    edit_slide_layout
)
TEMPLATE_ROUTER.post(
    "/slide-layout/edit-section", response_model=EditSlideLayoutSectionResponse
)(edit_slide_layout_section)
TEMPLATE_ROUTER.post("/save", response_model=SaveTemplateResponse)(save_template)
TEMPLATE_ROUTER.post("/clone", response_model=SaveTemplateResponse)(clone_template)
TEMPLATE_ROUTER.put("/update", response_model=SaveTemplateResponse)(update_template)
TEMPLATE_ROUTER.post("/slide-layout/save", status_code=200)(save_slide_layout)
TEMPLATE_ROUTER.post("/slide-layout/clone", response_model=SaveTemplateLayoutData)(
    clone_slide_layout
)
