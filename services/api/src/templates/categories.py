from enum import Enum


class TemplateCategory(str, Enum):
    """Soft enum for template categories.

    Stored as a free-form ``str`` in the database so adding a new category is
    a Python-only change. New templates are validated against this enum on
    write via ``TemplateCreate``; reads stay lenient so legacy values
    (``automation``, ``data-processing``, etc.) still round-trip.
    """

    GENERAL = "general"
    EMAIL = "email"
    ANALYTICS = "analytics"
    DEVELOPMENT = "development"
    CLOUD = "cloud"
    SCHEDULING = "scheduling"
    SOCIAL_MEDIA = "social_media"
    PRODUCTIVITY = "productivity"


class TemplateSource(str, Enum):
    """Origin of a template row.

    ``OFFICIAL`` templates come from the curated ``rune-templates`` repo bundle
    and are upserted by the seeder keyed by ``external_id``. ``USER`` templates
    are created via the save-template flow and owned by ``created_by``.
    """

    OFFICIAL = "official"
    USER = "user"


class TemplateScope(str, Enum):
    """The user-facing bucket a template belongs to.

    Derived from ``(source, is_public)`` so callers don't need to combine
    the two dimensions themselves:

    * ``OFFICIAL`` - curated by the Rune team, seeded from the
      ``rune-templates`` repo.
    * ``COMMUNITY`` - saved by an end user and marked public, visible to
      everyone on the Rune instance.
    * ``PERSONAL`` - saved by an end user for their own use, visible only
      to the creator.
    """

    OFFICIAL = "official"
    COMMUNITY = "community"
    PERSONAL = "personal"


def derive_scope(source: str, is_public: bool) -> TemplateScope:
    """Map storage fields to the user-facing scope bucket."""
    if source == TemplateSource.OFFICIAL.value:
        return TemplateScope.OFFICIAL
    return TemplateScope.COMMUNITY if is_public else TemplateScope.PERSONAL


class TemplateSort(str, Enum):
    """Sort options exposed on the templates list endpoint.

    ``FEATURED`` is the gallery default: official templates first, then by
    descending ``usage_count``. The other modes are straightforward
    single-column orderings.
    """

    FEATURED = "featured"
    POPULAR = "popular"
    NEWEST = "newest"
    ALPHABETICAL = "alphabetical"


def humanise_category(value: str) -> str:
    """Render a category slug for display (``social_media`` -> ``Social media``)."""
    return value.replace("_", " ").replace("-", " ").capitalize()
