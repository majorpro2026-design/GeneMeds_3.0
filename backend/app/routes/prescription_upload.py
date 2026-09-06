from __future__ import annotations

import base64
import os
import traceback
from typing import Any

from fastapi import APIRouter, UploadFile
from fastapi.responses import JSONResponse
from openai import OpenAI, OpenAIError
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.database import engine


router = APIRouter(prefix="/api")

_ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/tiff",
    "image/webp",
}
_MAX_FILE_BYTES = 5 * 1024 * 1024  # 5 MB
_VISION_MODEL = "gpt-4o"


def _extract_lines(file_bytes: bytes, content_type: str) -> list[dict[str, Any]]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY is not configured.")

    client = OpenAI(api_key=api_key)
    b64_image = base64.standard_b64encode(file_bytes).decode()

    response = client.chat.completions.create(
        model=_VISION_MODEL,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{content_type};base64,{b64_image}"},
                    },
                    {
                        "type": "text",
                        "text": (
                            "You are an OCR assistant. Extract every line of text visible "
                            "in this prescription image. Return ONLY the raw extracted text, "
                            "one line per line, exactly as it appears. Do not add explanations, "
                            "headings, or any text that is not in the image."
                        ),
                    },
                ],
            }
        ],
        temperature=0,
        max_tokens=2048,
    )

    raw_text = response.choices[0].message.content or ""
    return [
        {"text": line.strip(), "confidence": 1.0}
        for line in raw_text.splitlines()
        if line.strip()
    ]


def _match_drugs(lines: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not lines:
        return []

    line_texts = [line["text"] for line in lines]

    query = text(
        """
        WITH input_lines AS (
            SELECT unnest(CAST(:lines AS text[])) AS line_text
        ),
        brand_hits AS (
            SELECT
                il.line_text   AS matched_text,
                dbg.brand_name,
                dbg.generic_name,
                'brand'        AS matched_as
            FROM input_lines il
            JOIN knowledge.drug_brand_generic dbg
                ON il.line_text ILIKE '%' || btrim(dbg.brand_name) || '%'
            WHERE dbg.brand_name IS NOT NULL
        ),
        generic_hits AS (
            SELECT
                il.line_text   AS matched_text,
                d.generic_name AS brand_name,
                d.generic_name,
                'generic'      AS matched_as
            FROM input_lines il
            JOIN knowledge.drug d
                ON il.line_text ILIKE '%' || btrim(d.generic_name) || '%'
            WHERE d.generic_name IS NOT NULL
        ),
        all_hits AS (
            SELECT * FROM brand_hits
            UNION
            SELECT * FROM generic_hits
        )
        SELECT DISTINCT ON (lower(btrim(generic_name)))
            matched_text,
            generic_name,
            matched_as
        FROM all_hits
        ORDER BY lower(btrim(generic_name)), matched_as
        """
    )

    try:
        with engine.connect() as connection:
            rows = connection.execute(query, {"lines": line_texts}).mappings().all()
    except SQLAlchemyError:
        return []

    return [
        {
            "matchedText": row["matched_text"],
            "genericName": row["generic_name"],
            "matchedAs": row["matched_as"],
        }
        for row in rows
    ]


@router.post("/prescriptions/upload-extract")
async def upload_extract(file: UploadFile) -> Any:
    try:
        if file.content_type not in _ALLOWED_CONTENT_TYPES:
            return JSONResponse(status_code=400, content={
                "detail": (
                    f"Unsupported file type '{file.content_type}'. "
                    "Accepted: image/jpeg, image/png, image/tiff, image/webp."
                )
            })

        file_bytes = await file.read()

        if len(file_bytes) > _MAX_FILE_BYTES:
            return JSONResponse(status_code=400, content={
                "detail": f"File exceeds 5 MB limit ({len(file_bytes)/1024/1024:.1f} MB uploaded)."
            })

        try:
            lines = _extract_lines(file_bytes, file.content_type)
        except OpenAIError as exc:
            return JSONResponse(status_code=422, content={
                "detail": f"OpenAI OCR error: {exc}"
            })
        except ValueError as exc:
            return JSONResponse(status_code=500, content={"detail": str(exc)})

        if not lines:
            return JSONResponse(status_code=422, content={
                "detail": "No text was detected in the image."
            })

        matched_drugs = _match_drugs(lines)

        return {"rawText": lines, "matchedDrugs": matched_drugs}

    except Exception as exc:
        tb = traceback.format_exc()
        print(f"[upload-extract] UNHANDLED: {type(exc).__name__}: {exc}\n{tb}", flush=True)
        return JSONResponse(status_code=500, content={
            "detail": f"Unhandled error ({type(exc).__name__}): {exc}"
        })
