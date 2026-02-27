import yaml
from fastapi.openapi.utils import get_openapi

from src.app import app


def get_openapi_yaml():
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )

    # Write the schema as YAML to a file
    with open("./openapi.yaml", "w") as file:
        yaml.dump(openapi_schema, file, sort_keys=False)

    return openapi_schema


if __name__ == "__main__":
    openapi_schema = get_openapi_yaml()
    print("OpenAPI schema written to openapi.yaml")
