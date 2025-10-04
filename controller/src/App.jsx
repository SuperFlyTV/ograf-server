import * as React from "react";
import { Button, Form, Dropdown, ButtonGroup } from "react-bootstrap";

import { getDefaultDataFromSchema } from "ograf-form";

const SERVER_API_URL = "http://localhost:8080";

export function App() {
  const [serverApiUrl, setServerApiUrl] = React.useState(SERVER_API_URL);
  const [serverData, setServerData] = React.useState({});
  const [serverDataLoadedCount, setServerDataLoadedCount] = React.useState(0);

  const reloadServerData = React.useCallback(() => {
    console.log("Loading server data...");
    retrieveServerData(serverApiUrl)
      .then((data) => {
        console.log("server data loaded", data);
        setServerData(data);
        setServerDataLoadedCount((org) => org + 1);
      })
      .catch((err) => {
        console.error(err);
      });
  }, [serverApiUrl]);
  React.useEffect(() => {
    reloadServerData();
  }, []);

  return (
    <div className="container-md">
      <div>
        <h1>OGraf Simple Controller</h1>
      </div>
      <Form>
        <div className="mb-3">
          <label className="form-label" htmlFor="serverApiUrl">
            Server Url
          </label>
          <input
            type="text"
            id="serverApiUrl"
            className="form-control"
            placeholder="Server URL"
            value={serverApiUrl}
            onChange={(e) => setServerApiUrl(e.target.value)}
          />
        </div>
      </Form>
      <div className="mb-3">
        <Button onClick={() => reloadServerData()}> Reload Server Data </Button>
      </div>
      <div>
        <h2>Upload Graphics</h2>
        <form
          action={`${serverApiUrl}/serverApi/internal/graphics/graphic`}
          method="post"
          encType="multipart/form-data"
        >
          Upload Graphic (zip file): <br />
          <input type="file" id="graphic" name="graphic" accept=".zip" />
          <input type="submit" label="Upload" />
        </form>
      </div>
      <div>
        <h2>Control</h2>

        <div>
          {(serverData.renderers ?? []).map((renderer) => (
            <Renderer
              key={renderer.id}
              serverApiUrl={serverApiUrl}
              renderer={renderer}
              serverData={serverData}
              serverDataLoadedCount={serverDataLoadedCount}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

async function retrieveServerData(serverApiUrl) {
  const data = {
    graphics: [],
    renderers: [],
  };
  {
    const response = await fetch(`${serverApiUrl}/ograf/v1/graphics`);
    await handleBadResponse(response);

    const responseData = await response.json();
    if (!responseData.graphics)
      throw new Error(`Invalid response data: ${JSON.stringify(responseData)}`);
    data.graphics = responseData.graphics;
  }
  {
    const response = await fetch(`${serverApiUrl}/ograf/v1/renderers`);
    await handleBadResponse(response);

    const responseData = await response.json();
    if (!responseData.renderers)
      throw new Error(`Invalid response data: ${JSON.stringify(responseData)}`);
    data.renderers = responseData.renderers;
  }

  return data;
}

function Renderer({
  serverApiUrl,
  serverData,
  renderer,
  serverDataLoadedCount,
}) {
  const [rendererInfo, setRendererInfo] = React.useState(undefined);
  React.useEffect(() => {
    fetch(`${serverApiUrl}/ograf/v1/renderers/${renderer.id}`)
      .then(async (response) => {
        await handleBadResponse(response);

        const responseData = await response.json();
        if (!responseData.renderer)
          throw new Error(
            `Invalid response data: ${JSON.stringify(responseData)}`
          );
        setRendererInfo(responseData.renderer);
      })
      .catch(console.error);
  }, [renderer.id, serverDataLoadedCount]);

  console.log("rendererInfo", rendererInfo);

  const onCustomAction = (actionId, payload) => {
    fetch(
      `${serverApiUrl}/ograf/v1/renderers/${renderer.id}/customActions/${actionId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: payload,
        }),
      }
    )
      .then(async (response) => {
        await handleBadResponse(response);
      })
      .catch(console.error);
  };

  if (!rendererInfo) return "Loading Renderer...";

  return (
    <div className="card">
      <div className="card-body">
        <h3 className="card-title">{rendererInfo.name}</h3>
        <i className="card-subtitle">{rendererInfo.description}</i>
        <div>
          {rendererInfo.customActions &&
            rendererInfo.customActions.length > 0 && (
              <div>
                <h4>Renderer Custom actions</h4>

                {(rendererInfo.customActions || []).map((action) => {
                  return (
                    <div
                      key={action.id}
                      className="card"
                      style={{ width: "30em", display: "inline-block" }}
                    >
                      <div className="card-body">
                        <RendererCustomAction
                          action={action}
                          onAction={onCustomAction}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>
        <div>
          <h4>Render Targets</h4>
          <div>
            <RenderTargets
              serverApiUrl={serverApiUrl}
              serverData={serverData}
              renderer={rendererInfo}
            />
          </div>
        </div>
        <div>
          <GraphicPlaylist
            serverApiUrl={serverApiUrl}
            serverData={serverData}
            rendererInfo={rendererInfo}
          />
        </div>
      </div>
    </div>
  );
}
function RenderTargets({ serverApiUrl, serverData, renderer }) {
  const [renderTargets, setRenderTargets] = React.useState([]);

  // Loop to keep list of renderTargets updated:
  React.useEffect(() => {
    let timeoutActive = true;
    let timeout = null;

    const updateData = () => {
      if (!timeoutActive) return;

      fetch(`${serverApiUrl}/ograf/v1/renderers/${renderer.id}/`)
        .then(async (response) => {
          if (!timeoutActive) return;
          await handleBadResponse(response);

          return response.json();
        })
        .then((responseData) => {
          if (!timeoutActive) return;

          if (!responseData.renderer)
            throw new Error(
              `Invalid response data: ${JSON.stringify(responseData)}`
            );

          if (!timeoutActive) return;

          setRenderTargets((prevTargets) => {
            const targets = JSON.parse(JSON.stringify(prevTargets));

            for (const oldTarget of targets) {
              // Clear any pre-existing graphicInstances, to be populated again below:
              oldTarget.graphicInstances = [];
            }
            // Update the array with new values
            for (const newTarget of responseData.renderer.status
              .renderTargets) {
              const existingIndex = targets.findIndex((old) =>
                isEqual(old.renderTarget, newTarget.renderTarget)
              );

              if (existingIndex !== -1) {
                // Update existing
                targets[existingIndex] = newTarget;
              } else {
                targets.push(newTarget);
              }
            }

            if (!isEqual(prevTargets, targets)) {
              return targets;
            } else {
              // No change, return old data:
              return prevTargets;
            }
          });
        })
        .catch(console.error)
        .finally(() => {
          if (!timeoutActive) return;
          timeout = setTimeout(() => {
            updateData();
          }, 1000);
        });
    };

    updateData();

    return () => {
      clearTimeout(timeout);
      timeoutActive = false;
    };
  });

  return (
    <div>
      {renderTargets.map((renderTarget) => {
        return (
          <RenderTarget
            key={JSON.stringify(renderTarget.renderTarget)}
            serverApiUrl={serverApiUrl}
            serverData={serverData}
            renderer={renderer}
            renderTarget={renderTarget}
          />
        );

        // return (
        //   <div
        //     key={JSON.stringify(renderTarget.renderTarget)}
        //     className="card"
        //     style={{ width: "10em", display: "inline-block" }}
        //   >
        //     <div className="card-body">
        //       <h4 className="card-title">
        //         {renderTarget.name || renderTarget.id}
        //       </h4>
        //       <i className="card-subtitle">{renderTarget.description}</i>
        //       <div></div>
        //     </div>
        //   </div>
        // );
      })}
    </div>
  );
}
function RenderTargetPicker({ rendererInfo, onSelectRenderTarget }) {
  const schema = rendererInfo.renderTargetSchema;

  const formRef = React.useRef();

  const [data, setData] = React.useState(null);

  const onDataChange = React.useCallback((newData) => {
    setData(JSON.parse(JSON.stringify(newData)));
    onSelectRenderTarget(newData);
  });

  React.useEffect(() => {
    if (data !== null) return;
    const initialData = schema ? getDefaultDataFromSchema(schema) : {};
    onDataChange(initialData);
  }, [data]);

  React.useLayoutEffect(() => {
    if (formRef.current) {
      const listener = (e) => onDataChange(e.detail.data);
      formRef.current.addEventListener("onChange", listener);
      return () => {
        formRef.current.removeEventListener("onChange", listener);
      };
    }
  });

  return (
    <div>
      <superflytv-ograf-form
        ref={formRef}
        schema={JSON.stringify(schema)}
        data={JSON.stringify(data)}
      ></superflytv-ograf-form>
    </div>
  );
}

function RendererCustomAction({ action, onAction }) {
  const schema = action.schema;

  const formRef = React.useRef();

  const [data, setData] = React.useState(null);

  const onDataChange = React.useCallback((newData) => {
    setData(JSON.parse(JSON.stringify(newData)));
  });

  React.useEffect(() => {
    if (data !== null) return;
    const initialData = schema ? getDefaultDataFromSchema(schema) : {};
    onDataChange(initialData);
  }, [data]);

  React.useLayoutEffect(() => {
    if (formRef.current) {
      const listener = (e) => onDataChange(e.detail.data);
      formRef.current.addEventListener("onChange", listener);
      return () => {
        formRef.current.removeEventListener("onChange", listener);
      };
    }
  });

  return (
    <div>
      <div>
        {schema && (
          <superflytv-ograf-form
            ref={formRef}
            schema={JSON.stringify(schema)}
            data={JSON.stringify(data)}
          ></superflytv-ograf-form>
        )}
      </div>
      <Button
        onClick={() => {
          // Invoke action:
          onAction(action.id, data);
        }}
      >
        {action.name || action.id}
      </Button>
    </div>
  );
}

function RenderTarget({ serverApiUrl, serverData, renderer, renderTarget }) {
  // console.log("renderTarget", renderTarget);
  return (
    <div className="card" style={{ width: "10em", display: "inline-block" }}>
      <div className="card-body">
        <h4 className="card-title">{renderTarget.name || renderTarget.id}</h4>
        <i className="card-subtitle">{renderTarget.description}</i>
        <div>
          <Button
            onClick={() => {
              fetch(
                `${serverApiUrl}/ograf/v1/renderers/${renderer.id}/target/graphic/clear`,
                {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    filters: { renderTarget: renderTarget.renderTarget },
                  }),
                }
              )
                .then(async (response) => {
                  await handleBadResponse(response);
                })
                .catch(console.error);
            }}
          >
            Clear
          </Button>
        </div>
        <div>
          {renderTarget.graphicInstances.map((graphicInstance) => {
            return (
              <div key={graphicInstance.graphicInstanceId}>
                {graphicInstance.graphic.name} ({graphicInstance.graphic.id})
              </div>
            );
            // return null;
          })}
        </div>
      </div>
    </div>
  );
}

function GraphicPlaylist({ serverApiUrl, serverData, rendererInfo }) {
  const [graphicQueue, setGraphicQueue] = React.useState([]);
  const [renderTarget, setRenderTarget] = React.useState(undefined);

  const onSelectRenderTarget = (renderTarget) => {
    setRenderTarget(renderTarget);
  };

  return (
    <div>
      <div>
        <RenderTargetPicker
          rendererInfo={rendererInfo}
          onSelectRenderTarget={onSelectRenderTarget}
        />
      </div>

      {renderTarget && (
        <Dropdown>
          <Dropdown.Toggle variant="success" id="dropdown-basic">
            Add Graphic
          </Dropdown.Toggle>
          <Dropdown.Menu>
            {serverData.graphics.map((graphic) => {
              return (
                <Dropdown.Item
                  key={`${graphic.id}-${graphic.version}`}
                  onClick={() => {
                    setGraphicQueue([
                      ...graphicQueue,
                      clone({ renderTarget, graphic }),
                    ]);
                  }}
                >
                  {graphic.name}
                </Dropdown.Item>
              );
            })}
          </Dropdown.Menu>
        </Dropdown>
      )}

      <div>
        {graphicQueue.map((item, index) => (
          <QueuedGraphic
            key={index}
            serverApiUrl={serverApiUrl}
            serverData={serverData}
            renderer={rendererInfo}
            graphic={item.graphic}
            renderTarget={item.renderTarget}
          />
        ))}
      </div>
    </div>
  );
}
function QueuedGraphic({
  serverApiUrl,
  serverData,
  renderer,
  graphic,
  renderTarget,
}) {
  // const [renderTarget, setRenderTarget] = React.useState(renderer.targets[0]);

  const graphicInfo = getGraphicInfo(serverApiUrl, graphic);

  const [data, setData] = React.useState({});

  React.useEffect(() => {
    const initialData = graphicInfo
      ? getDefaultDataFromSchema(graphicInfo.manifest.schema)
      : undefined;

    if (
      initialData !== undefined &&
      Object.keys(data).length === 0 &&
      Object.keys(initialData).length > 0
    ) {
      setData(initialData);
    }
  }, [graphicInfo]);

  const onDataSave = (d) => {
    setData(JSON.parse(JSON.stringify(d)));
  };

  const onAction = (actionName, params) => {
    const queryParams = new URLSearchParams();
    queryParams.append("renderTarget", JSON.stringify(renderTarget));
    queryParams.append(
      "graphicTarget",
      JSON.stringify({ graphicId: graphic.id })
    );

    fetch(
      `${serverApiUrl}/ograf/v1/renderers/${renderer.id}/target/graphic/${actionName}?${queryParams}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ params: params }),
      }
    )
      .then(async (response) => {
        await handleBadResponse(response);
      })
      .catch(console.error);
  };

  if (!graphicInfo) return <div>Loading Graphic...</div>;
  console.log("graphicInfo", graphicInfo);
  return (
    <div>
      <h4>{graphic.name}</h4>
      <div>
        <Form>
          <div className="mb-3">
            <label className="form-label">RenderTarget</label>
            <div>{JSON.stringify(renderTarget)}</div>
            {/* <Dropdown>
              <Dropdown.Toggle variant="success" id="dropdown-basic">
                {renderTarget.name || renderTarget.id}
              </Dropdown.Toggle>
              {<Dropdown.Menu>
                {renderer.targets.map((rt) => {
                  return (
                    <Dropdown.Item
                      key={rt.id}
                      onClick={() => {
                        setRenderTarget(rt);
                      }}
                    >
                      {rt.name || rt.id}
                    </Dropdown.Item>
                  );
                })}
              </Dropdown.Menu>}
            </Dropdown> */}
          </div>
          <div className="mb-3">
            <Button
              onClick={() => {
                const queryParams = new URLSearchParams();
                queryParams.append(
                  "renderTarget",
                  JSON.stringify(renderTarget)
                );
                apiFetch(
                  `${serverApiUrl}/ograf/v1/renderers/${renderer.id}/target/graphic/load?${queryParams}`,
                  {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      graphicId: graphic.id,
                      params: {
                        data: data,
                      },
                    }),
                  }
                );
              }}
            >
              Load
            </Button>
          </div>
          <div>
            <GraphicsDefaultActions
              schema={graphicInfo.manifest.schema}
              data={data}
              onAction={onAction}
              onDataSave={onDataSave}
            />
          </div>
          <div>
            {graphicInfo && (
              <div>
                {(graphicInfo.manifest.customActions || []).map((action) => {
                  return (
                    <div
                      key={action.id}
                      className="card"
                      style={{ width: "30em", display: "inline-block" }}
                    >
                      <div className="card-body">
                        <GraphicsCustomAction
                          action={action}
                          onAction={onAction}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Form>
      </div>
    </div>
  );
}

const graphicsInfoCache = {};
function getGraphicInfo(serverApiUrl, graphic) {
  console.log("graphic", graphic);
  const [graphicInfo, setGraphicInfo] = React.useState(
    graphicsInfoCache[graphic.id]
  );

  React.useEffect(() => {
    if (!graphicInfo) {
      fetch(`${serverApiUrl}/ograf/v1/graphics/${graphic.id}/`)
        .then(async (response) => {
          await handleBadResponse(response);

          return response.json();
        })
        .then((responseData) => {
          if (!responseData.graphic)
            throw new Error(
              `Invalid response data: ${JSON.stringify(responseData)}`
            );
          if (!responseData.manifest)
            throw new Error(
              `Invalid response data: ${JSON.stringify(responseData)}`
            );

          graphicsInfoCache[graphic.id] = responseData;
          setGraphicInfo(responseData);
        })
        .catch(console.error);
    }
  }, []);

  // use cache?
  if (graphicInfo) return graphicInfo;

  return;
}

function GraphicsDefaultActions({ schema, onAction, onDataSave, data }) {
  const formRef = React.useRef();
  React.useLayoutEffect(() => {
    if (formRef.current) {
      const listener = (e) => onDataSave(e.detail.data);
      formRef.current.addEventListener("onChange", listener);
      return () => {
        formRef.current.removeEventListener("onChange", listener);
      };
    }
  });

  return (
    <div>
      <div>
        {schema && (
          <superflytv-ograf-form
            ref={formRef}
            schema={JSON.stringify(schema)}
            data={JSON.stringify(data)}
          ></superflytv-ograf-form>
        )}
      </div>
      <div>
        <ButtonGroup>
          <Button
            onClick={() => {
              onAction("updateAction", {
                data: data,
              });
            }}
          >
            Update
          </Button>
          <Button
            onClick={() => {
              onAction("playAction", {
                // delta: undefined,
                // goto: undefined,
                // skipAnimation: undefined
              });
            }}
          >
            Play
          </Button>
          <Button
            onClick={() => {
              onAction("stopAction", {
                // skipAnimation: undefined
              });
            }}
          >
            Stop
          </Button>
        </ButtonGroup>
      </div>
    </div>
  );
}
function GraphicsCustomAction({ action, onAction }) {
  const initialData = action.schema
    ? getDefaultDataFromSchema(action.schema)
    : {};
  const schema = action.schema;

  const [data, setData] = React.useState(initialData);

  const onDataSave = (d) => {
    setData(JSON.parse(JSON.stringify(d)));
  };

  const formRef = React.useRef();
  React.useLayoutEffect(() => {
    if (formRef.current) {
      const listener = (e) => onDataSave(e.detail.data);
      formRef.current.addEventListener("onChange", listener);
      return () => {
        formRef.current.removeEventListener("onChange", listener);
      };
    }
  });

  return (
    <div>
      <div>
        {schema && (
          <superflytv-ograf-form
            ref={formRef}
            schema={JSON.stringify(schema)}
            data={JSON.stringify(data)}
          ></superflytv-ograf-form>
        )}
      </div>
      <Button
        onClick={() => {
          // Invoke action:
          onAction("customAction", {
            id: action.id,
            payload: data,
          });
        }}
      >
        {action.name || action.id}
      </Button>
    </div>
  );
}

function isEqual(a, b) {
  if (typeof a !== typeof b) return false;

  if (typeof a === "object") {
    if (Array.isArray(a)) {
      if (!Array.isArray(b)) return false;
      // Compare arrays
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!isEqual(a[i], b[i])) return false;
      }
      return true;
    } else {
      // Compare objects
      if (Object.keys(a).length !== Object.keys(b).length) return false;

      for (const key of Object.keys(a)) {
        if (!isEqual(a[key], b[key])) return false;
      }
      return true;
    }
  } else {
    return a === b;
  }
}
function clone(o) {
  return JSON.parse(JSON.stringify(o));
}
function apiFetch(url, params) {
  // console.log(url, params);
  fetch(url, params)
    .then(async (response) => {
      await handleBadResponse(response);
    })
    .catch(console.error);
}
async function handleBadResponse(response) {
  if (!response.ok) {
    // console.log(response.text);
    throw new Error(
      `HTTP response error: [${response.status}] ${JSON.stringify(
        await response.text()
      )}`
    );
  }
}
