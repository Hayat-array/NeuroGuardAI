/**
 * usePrediction.js — Custom hook for EEG file/manual analysis
 *
 * Wraps analyzeFile() and analyzeManual() API calls with consistent
 * loading + error state handling.
 */

import { useState, useCallback } from "react";
import { analyzeFile, analyzeManual } from "../services/api";

export function usePrediction() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const runFileAnalysis = useCallback(async (file) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await analyzeFile(file);
      setResult(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const runManualAnalysis = useCallback(async (textData) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await analyzeManual(textData);
      setResult(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, result, runFileAnalysis, runManualAnalysis };
}
