"""
rl_agent.py
-----------
Deep Q-Network (DQN) agent for adaptive real-time seizure detection.

The RL agent learns WHEN to raise an alert based on the DL model's
probability output, adapting its threshold dynamically to minimise
false positives while penalising missed seizures.
"""

import numpy as np
import tensorflow as tf
from tensorflow.keras.models import Model
from tensorflow.keras.layers import Dense, Input, LSTM
from tensorflow.keras.optimizers import Adam
from collections import deque
import random


# ── Environment ───────────────────────────────────────────────────────────────

class EEGEpilepsyEnv:
    """
    Custom RL environment simulating a live EEG stream.

    State  : one EEG window (178 samples)
    Actions:
        0 = Monitor / Wait
        1 = Alert  / Intervene

    Reward design (clinical priority: never miss a seizure):
        True  Positive (+10) : alert when seizure present
        False Positive (-5)  : alert when no seizure
        False Negative (-10) : miss a real seizure  ← heaviest penalty
        True  Negative (+0.5): correctly wait
    """

    def __init__(self, data_stream, labels, window_size=178):
        self.data_stream = data_stream
        self.labels      = labels
        self.window_size = window_size
        self.current_step = 0
        self.done = False

    def reset(self):
        self.current_step = 0
        self.done = False
        return self.data_stream[self.current_step]

    def step(self, action):
        label  = self.labels[self.current_step]
        reward = self._reward(action, label)

        self.current_step += 1
        if self.current_step >= len(self.data_stream):
            self.done       = True
            next_state      = np.zeros_like(self.data_stream[0])
        else:
            next_state = self.data_stream[self.current_step]

        return next_state, reward, self.done, {'label': label}

    @staticmethod
    def _reward(action, label):
        if action == 1:   # Alert
            return 10.0 if label == 1 else -5.0
        else:             # Wait
            return -10.0  if label == 1 else  0.5


# ── DQN Agent ─────────────────────────────────────────────────────────────────

class DRLAgent:
    """
    Deep Q-Network (DQN) with experience replay and ε-greedy exploration.
    """

    def __init__(self, state_size, action_size=2):
        self.state_size  = state_size    # (178, 1)
        self.action_size = action_size

        self.memory         = deque(maxlen=5000)
        self.gamma          = 0.95    # discount factor
        self.epsilon        = 1.0     # exploration rate
        self.epsilon_min    = 0.01
        self.epsilon_decay  = 0.995
        self.learning_rate  = 1e-3
        self.batch_size     = 32

        self.model        = self._build_model()
        self.target_model = self._build_model()   # stable target network
        self.update_target_every = 100
        self._step_count  = 0

    def _build_model(self):
        """LSTM Q-network: state → Q-values for each action."""
        inp = Input(shape=self.state_size)
        x   = LSTM(64,  return_sequences=True)(inp)
        x   = LSTM(32,  return_sequences=False)(x)
        x   = Dense(32, activation='relu')(x)
        out = Dense(self.action_size, activation='linear')(x)

        model = Model(inp, out)
        model.compile(loss='mse', optimizer=Adam(learning_rate=self.learning_rate))
        return model

    def remember(self, state, action, reward, next_state, done):
        self.memory.append((state, action, reward, next_state, done))

    def act(self, state):
        """ε-greedy action selection."""
        if np.random.rand() <= self.epsilon:
            return random.randrange(self.action_size)
        q_vals = self.model.predict(state[np.newaxis, ...], verbose=0)
        return int(np.argmax(q_vals[0]))

    def replay(self):
        """Experience replay training step."""
        if len(self.memory) < self.batch_size:
            return

        batch       = random.sample(self.memory, self.batch_size)
        states      = np.array([b[0] for b in batch])
        next_states = np.array([b[3] for b in batch])

        q_current = self.model.predict(states,      verbose=0)
        q_next    = self.target_model.predict(next_states, verbose=0)

        for i, (state, action, reward, next_state, done) in enumerate(batch):
            target = reward if done else reward + self.gamma * np.amax(q_next[i])
            q_current[i][action] = target

        self.model.fit(states, q_current, epochs=1, verbose=0)

        # Decay exploration
        if self.epsilon > self.epsilon_min:
            self.epsilon *= self.epsilon_decay

        # Periodically sync target network
        self._step_count += 1
        if self._step_count % self.update_target_every == 0:
            self.target_model.set_weights(self.model.get_weights())

    def save(self, path):
        self.model.save(path)

    def load(self, path):
        self.model = tf.keras.models.load_model(path)
        self.target_model.set_weights(self.model.get_weights())


# ── Training Loop ─────────────────────────────────────────────────────────────

def train_drl_agent(data_stream, labels, episodes=50, window_size=178):
    """
    Trains the DRL agent on segmented EEG windows.

    Args:
        data_stream : np.array (n_segments, window_size, 1)
        labels      : np.array (n_segments,)
        episodes    : number of full passes through the stream
        window_size : int

    Returns:
        Trained DRLAgent
    """
    env   = EEGEpilepsyEnv(data_stream, labels, window_size)
    agent = DRLAgent(state_size=(window_size, 1))

    print(f"[DRL] Training for {episodes} episodes on {len(data_stream)} steps...")

    for ep in range(1, episodes + 1):
        state      = env.reset()
        total_rwd  = 0.0
        alerts     = 0

        while not env.done:
            action              = agent.act(state)
            next_state, reward, done, info = env.step(action)
            agent.remember(state, action, reward, next_state, done)
            agent.replay()
            state       = next_state
            total_rwd  += reward
            alerts      += action

        if ep % 10 == 0 or ep == 1:
            print(f"  Episode {ep:3d}/{episodes} | "
                  f"Total Reward: {total_rwd:8.1f} | "
                  f"Alerts: {alerts:4d} | "
                  f"ε: {agent.epsilon:.3f}")

    print("[DRL] Training complete.")
    return agent