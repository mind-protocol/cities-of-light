import { createLocalLoopStudio } from '../client/loop-studio-intents.js';

function resultEnvelope(result) {
  return { result };
}

function errorEnvelope(error) {
  return {
    error: error instanceof Error ? error.message : String(error),
    information_status: 'measurement_failed',
  };
}

export function createLoopStudioApi({ initialSnapshot } = {}) {
  const studio = createLocalLoopStudio(initialSnapshot);

  function sense() {
    const observed = studio.sense();
    return {
      ...observed,
      genesis: studio.exportBundle().genesis,
      adapter: 'engine-memory-v0',
    };
  }

  function act(semanticIntent) {
    if (!semanticIntent || typeof semanticIntent !== 'object') {
      throw new Error('semantic_intent is required');
    }
    return {
      receipt: studio.act(semanticIntent),
      adapter: 'engine-memory-v0',
    };
  }

  function attach(app, {
    sensePath = '/api/loop-studio/sense',
    actPath = '/api/loop-studio/act',
  } = {}) {
    app.post(sensePath, (req, res) => {
      try {
        res.json(resultEnvelope(sense()));
      } catch (error) {
        res.status(500).json(errorEnvelope(error));
      }
    });

    app.post(actPath, (req, res) => {
      try {
        res.json(resultEnvelope(act(req.body?.semantic_intent)));
      } catch (error) {
        res.status(400).json(errorEnvelope(error));
      }
    });

    return { sensePath, actPath };
  }

  return Object.freeze({ sense, act, attach });
}

export function attachLoopStudioApi(app, options = {}) {
  const api = createLoopStudioApi(options);
  const routes = api.attach(app, options);
  return { api, routes };
}
