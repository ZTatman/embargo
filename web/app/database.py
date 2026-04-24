import datetime

from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.types import DateTime


class Base(DeclarativeBase):
    type_annotation_map = {
        datetime.datetime: DateTime(timezone=True),
    }
