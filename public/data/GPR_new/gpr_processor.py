"""
GPR Data Processing & Modeling Pipeline
========================================
Reads GSSI SIR-4000 DZT/DZX files, processes raw GPR data,
and generates 2D/3D visualizations and structural models.
"""
import struct
import numpy as np
from scipy import signal, ndimage
from scipy.interpolate import interp1d
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap
import matplotlib.gridspec as gridspec
from pathlib import Path
import json
import warnings
warnings.filterwarnings('ignore')

# ============================================================
# CONSTANTS & CONFIGURATION
# ============================================================
C = 0.299792458  # speed of light in m/ns
DIELECTRIC = 8.0  # relative permittivity (from DZX)
VELOCITY = C / np.sqrt(DIELECTRIC)  # m/ns
SCANS_PER_METER = 50.0
SAMPLES_PER_SCAN = 1024
SCAN_SPACING = 1.0 / SCANS_PER_METER  # meters between scans


class GPRData:
    """Container for a single GPR survey line."""

    def __init__(self, name, raw_data, depth_range_m=31.82):
        self.name = name
        self.raw = raw_data.astype(np.float64)
        self.n_scans, self.n_samples = raw_data.shape
        self.depth_range_m = depth_range_m
        self.scan_spacing_m = SCAN_SPACING
        self.profile_length_m = self.n_scans * self.scan_spacing_m

        # Time axis (two-way travel time in ns)
        self.twt_ns = depth_range_m * 2 / VELOCITY
        self.time_axis = np.linspace(0, self.twt_ns, self.n_samples)
        self.dt_ns = self.twt_ns / self.n_samples

        # Depth axis
        self.depth_axis = np.linspace(0, depth_range_m, self.n_samples)
        self.distance_axis = np.linspace(0, self.profile_length_m, self.n_scans)

        # Processed data container
        self.processed = None
        self.background = None

    # ---- Processing Steps ----
    def dewow(self, window=10):
        """Remove DC bias / low-frequency 'wow' using running mean subtraction."""
        data = self.raw.copy()
        for i in range(self.n_scans):
            trace = data[i, :]
            # Running mean
            kernel = np.ones(window) / window
            running_mean = np.convolve(trace, kernel, mode='same')
            data[i, :] = trace - running_mean
        self.processed = data

    def remove_background(self):
        """Remove horizontal banding by subtracting the average trace."""
        if self.processed is None:
            self.processed = self.raw.copy()
        self.background = self.processed.mean(axis=0)
        self.processed = self.processed - self.background[np.newaxis, :]

    def bandpass_filter(self, low_cut=10, high_cut=500, order=4):
        """Apply Butterworth bandpass filter to each trace (frequencies in MHz)."""
        if self.processed is None:
            self.processed = self.raw.copy()
        nyquist = 0.5 / (self.dt_ns * 1e-9)  # Nyquist freq in Hz
        low = low_cut * 1e6 / nyquist
        high = high_cut * 1e6 / nyquist
        b, a = signal.butter(order, [low, high], btype='band')
        for i in range(self.n_scans):
            self.processed[i, :] = signal.filtfilt(b, a, self.processed[i, :])

    def apply_gain(self, gain_type='agc', agc_window=50):
        """Apply gain to compensate for signal attenuation."""
        if self.processed is None:
            self.processed = self.raw.copy()
        if gain_type == 'agc':
            self._agc(agc_window)
        elif gain_type == 'exp':
            alpha = np.log(100) / self.n_samples
            gain = np.exp(alpha * np.arange(self.n_samples))
            self.processed *= gain[np.newaxis, :]

    def _agc(self, window):
        """Automatic Gain Control - normalize amplitude in sliding window."""
        for i in range(self.n_scans):
            trace = self.processed[i, :]
            # Compute RMS envelope in sliding window
            rms = np.zeros_like(trace)
            half_win = window // 2
            for j in range(len(trace)):
                start = max(0, j - half_win)
                end = min(len(trace), j + half_win)
                rms[j] = np.sqrt(np.mean(trace[start:end] ** 2)) + 1e-10
            self.processed[i, :] = trace / rms

    def process_pipeline(self):
        """Run the full processing pipeline."""
        self.dewow(window=10)
        self.remove_background()
        self.bandpass_filter(low_cut=25, high_cut=400)
        self.apply_gain(gain_type='agc', agc_window=40)

    # ---- Visualization ----
    def plot_radargram(self, data=None, title=None, ax=None, cmap='gray',
                       clip_percentile=99, use_depth=True):
        """Plot a B-scan radargram."""
        if data is None:
            data = self.processed if self.processed is not None else self.raw

        if ax is None:
            _, ax = plt.subplots(figsize=(14, 6))

        # Clip amplitudes for display
        vmax = np.percentile(np.abs(data), clip_percentile)
        vmin = -vmax

        if use_depth:
            extent = [0, self.profile_length_m, self.depth_range_m, 0]
            ylabel = 'Depth (m)'
        else:
            extent = [0, self.profile_length_m, self.twt_ns, 0]
            ylabel = 'Two-Way Travel Time (ns)'

        im = ax.imshow(data.T, aspect='auto', cmap=cmap, extent=extent,
                       vmin=vmin, vmax=vmax, interpolation='bilinear')
        ax.set_xlabel('Distance (m)')
        ax.set_ylabel(ylabel)
        ax.set_title(title or f'{self.name} - B-Scan')
        plt.colorbar(im, ax=ax, label='Amplitude', shrink=0.8)
        return ax

    def plot_wiggle(self, trace_spacing=5, ax=None, scale=0.5):
        """Plot wiggle traces."""
        if ax is None:
            _, ax = plt.subplots(figsize=(14, 6))

        data = self.processed if self.processed is not None else self.raw
        norm = np.percentile(np.abs(data), 99)
        for i in range(0, self.n_scans, trace_spacing):
            trace = data[i, :] / (norm + 1e-10) * self.scan_spacing_m * scale
            x = self.distance_axis[i] + trace
            ax.plot(x, self.depth_axis, 'k-', linewidth=0.5)
            ax.fill_betweenx(self.depth_axis, self.distance_axis[i], x,
                             where=(trace >= 0), color='k', alpha=0.5)
        ax.set_xlim(-0.1, self.profile_length_m + 0.1)
        ax.set_ylim(self.depth_range_m, 0)
        ax.set_xlabel('Distance (m)')
        ax.set_ylabel('Depth (m)')
        ax.set_title(f'{self.name} - Wiggle Traces')
        return ax

    def plot_spectrum(self, ax=None):
        """Plot the average frequency spectrum."""
        if ax is None:
            _, ax = plt.subplots(figsize=(10, 4))

        data = self.processed if self.processed is not None else self.raw
        for i in range(0, self.n_scans, max(1, self.n_scans // 20)):
            freqs = np.fft.rfftfreq(self.n_samples, self.dt_ns * 1e-9)
            spectrum = np.abs(np.fft.rfft(data[i, :]))
            ax.plot(freqs / 1e6, spectrum, 'b-', alpha=0.3, linewidth=0.5)

        ax.set_xlabel('Frequency (MHz)')
        ax.set_ylabel('Amplitude')
        ax.set_title(f'{self.name} - Frequency Spectrum')
        ax.set_xlim(0, 600)
        return ax

    # ---- Analysis ----
    def get_envelope(self):
        """Compute the amplitude envelope using Hilbert transform."""
        data = self.processed if self.processed is not None else self.raw
        envelope = np.zeros_like(data)
        for i in range(self.n_scans):
            analytic = signal.hilbert(data[i, :])
            envelope[i, :] = np.abs(analytic)
        return envelope

    def pick_first_breaks(self, threshold_factor=3):
        """Pick first arrival times by energy threshold."""
        data = self.processed if self.processed is not None else self.raw
        picks = np.zeros(self.n_scans)
        for i in range(self.n_scans):
            trace = data[i, :]
            noise_level = np.std(trace[-100:])  # late samples as noise
            threshold = noise_level * threshold_factor
            for j in range(50, len(trace)):
                if abs(trace[j]) > threshold:
                    picks[i] = j
                    break
        return picks

    def extract_amplitude_map(self, depth_start, depth_end):
        """Extract average amplitude in a depth window."""
        data = self.processed if self.processed is not None else self.raw
        env = np.abs(signal.hilbert(data, axis=1))
        idx_start = int(depth_start / self.depth_range_m * self.n_samples)
        idx_end = int(depth_end / self.depth_range_m * self.n_samples)
        return np.mean(env[:, idx_start:idx_end], axis=1)


def read_dzt(filepath):
    """Read a GSSI DZT file and return numpy array of scan data."""
    with open(filepath, 'rb') as f:
        data = f.read()

    header = data[:128]
    rh_data = struct.unpack_from('<H', header, 2)[0]  # data offset
    rh_nsamp = struct.unpack_from('<H', header, 4)[0]  # samples per scan

    data_bytes = len(data) - rh_data
    n_scans = data_bytes // (rh_nsamp * 2)  # 16-bit data

    raw = np.frombuffer(data[rh_data:rh_data + n_scans * rh_nsamp * 2],
                        dtype=np.uint16)
    return raw.reshape(n_scans, rh_nsamp)


def build_depth_model(lines, output_dir):
    """Build a combined depth model from all survey lines."""
    n_lines = len(lines)
    max_scans = max(line.n_scans for line in lines)
    max_depth_samples = max(line.n_samples for line in lines)
    max_depth = max(line.depth_range_m for line in lines)

    # Interpolate each line onto a common grid
    model = np.zeros((n_lines, max_scans, max_depth_samples))

    for idx, line in enumerate(lines):
        data = line.processed if line.processed is not None else line.raw
        for d in range(line.n_samples):
            model[idx, :line.n_scans, d] = data[:, d]

    return model


def plot_comprehensive_report(line1, line2, output_dir):
    """Generate a comprehensive multi-panel report."""
    fig = plt.figure(figsize=(20, 24))
    gs = gridspec.GridSpec(5, 3, figure=fig, hspace=0.35, wspace=0.3)

    # Custom colormap for GPR
    colors = [(0.2, 0.1, 0.1), (0.1, 0.2, 0.4), (0.5, 0.5, 0.5),
              (0.6, 0.6, 0.3), (0.9, 0.8, 0.2), (0.2, 0.1, 0.1)]
    gpr_cmap = LinearSegmentedColormap.from_list('gpr', colors, N=256)

    # Row 1: Raw data comparison
    ax = fig.add_subplot(gs[0, :2])
    raw2 = line2.raw.copy().astype(np.float64)
    # Quick dewow + background removal for display
    for i in range(raw2.shape[0]):
        kernel = np.ones(10) / 10
        raw2[i, :] = raw2[i, :] - np.convolve(raw2[i, :], kernel, mode='same')
    raw2 = raw2 - raw2.mean(axis=0)
    vmax = np.percentile(np.abs(raw2), 98)
    ax.imshow(raw2.T, aspect='auto', cmap='gray', vmin=-vmax, vmax=vmax,
              extent=[0, line2.profile_length_m, line2.depth_range_m, 0])
    ax.set_title('Line 2 - Quick-Processed Raw Data')
    ax.set_xlabel('Distance (m)')
    ax.set_ylabel('Depth (m)')

    ax = fig.add_subplot(gs[0, 2])
    # Depth-velocity model annotation
    depths_m = np.arange(0, 32, 0.5)
    velocities = C / np.sqrt(np.linspace(4, 15, len(depths_m)))
    ax.plot(velocities, depths_m, 'b-', linewidth=2)
    ax.fill_betweenx(depths_m, velocities - 0.01, velocities + 0.01, alpha=0.3)
    ax.set_ylabel('Depth (m)')
    ax.set_xlabel('Velocity (m/ns)')
    ax.set_title('Velocity Model (εr=4-15)')
    ax.set_ylim(max(depths_m), 0)
    ax.grid(True, alpha=0.3)

    # Row 2: Processed data
    for idx, line in enumerate([line1, line2]):
        ax = fig.add_subplot(gs[1, idx])
        data = line.processed if line.processed is not None else line.raw
        vmax = np.percentile(np.abs(data), 98)
        ax.imshow(data.T, aspect='auto', cmap=gpr_cmap, vmin=-vmax, vmax=vmax,
                  extent=[0, line.profile_length_m, line.depth_range_m, 0])
        ax.set_title(f'{line.name} - Processed')
        ax.set_xlabel('Distance (m)')
        ax.set_ylabel('Depth (m)')

    ax = fig.add_subplot(gs[1, 2])
    # Envelope overlay comparison
    env1 = np.abs(signal.hilbert(line1.processed, axis=1))
    # Average envelope
    avg_env = env1.mean(axis=0)
    ax.plot(avg_env / np.max(avg_env), line1.depth_axis, 'r-', linewidth=1.5, label='Line 1')
    env2 = np.abs(signal.hilbert(line2.processed, axis=1))
    avg_env2 = env2.mean(axis=0)
    ax.plot(avg_env2 / np.max(avg_env2), line2.depth_axis, 'b-', linewidth=1.5, label='Line 2')
    ax.set_ylim(line1.depth_range_m, 0)
    ax.set_xlabel('Normalized Amplitude')
    ax.set_ylabel('Depth (m)')
    ax.set_title('Average Amplitude Envelope')
    ax.legend()
    ax.grid(True, alpha=0.3)

    # Row 3: Feature extraction
    for idx, line in enumerate([line1, line2]):
        ax = fig.add_subplot(gs[2, idx])
        data = line.processed if line.processed is not None else line.raw
        # Compute instantaneous amplitude and phase
        envelope = np.zeros_like(data)
        inst_freq = np.zeros_like(data)
        for i in range(line.n_scans):
            analytic = signal.hilbert(data[i, :])
            envelope[i, :] = np.abs(analytic)
            phase = np.diff(np.unwrap(np.angle(analytic)))
            inst_freq[i, 1:] = np.clip(phase, -np.pi, np.pi)

        vmax = np.percentile(envelope, 98)
        ax.imshow(envelope.T, aspect='auto', cmap='hot', vmin=0, vmax=vmax,
                  extent=[0, line.profile_length_m, line.depth_range_m, 0])
        ax.set_title(f'{line.name} - Amplitude Envelope')
        ax.set_xlabel('Distance (m)')
        ax.set_ylabel('Depth (m)')

    ax = fig.add_subplot(gs[2, 2])
    # Trace comparison at midpoint
    mid_scan1 = line1.n_scans // 2
    mid_scan2 = line2.n_scans // 2
    data1 = line1.processed if line1.processed is not None else line1.raw
    data2 = line2.processed if line2.processed is not None else line2.raw
    ax.plot(data1[mid_scan1, :] / np.max(np.abs(data1[mid_scan1, :])),
            line1.depth_axis, 'r-', linewidth=1, label=f'{line1.name} scan {mid_scan1}')
    ax.plot(data2[mid_scan2, :] / np.max(np.abs(data2[mid_scan2, :])),
            line2.depth_axis, 'b-', linewidth=1, label=f'{line2.name} scan {mid_scan2}')
    ax.set_ylim(line1.depth_range_m, 0)
    ax.set_xlabel('Normalized Amplitude')
    ax.set_ylabel('Depth (m)')
    ax.set_title('Mid-Profile Trace Comparison')
    ax.legend()
    ax.grid(True, alpha=0.3)

    # Row 4: Spectrum
    for idx, line in enumerate([line1, line2]):
        ax = fig.add_subplot(gs[3, idx])
        freqs = np.fft.rfftfreq(line.n_samples, line.dt_ns * 1e-9)
        # Average spectrum
        data = line.processed if line.processed is not None else line.raw
        avg_spectrum = np.abs(np.fft.rfft(data, axis=1)).mean(axis=0)
        ax.plot(freqs / 1e6, avg_spectrum, 'k-', linewidth=1.5)
        ax.fill_between(freqs / 1e6, 0, avg_spectrum, alpha=0.3, color='blue')
        ax.set_xlabel('Frequency (MHz)')
        ax.set_ylabel('Amplitude')
        ax.set_title(f'{line.name} - Avg Frequency Spectrum')
        ax.set_xlim(0, 500)
        ax.grid(True, alpha=0.3)

    ax = fig.add_subplot(gs[3, 2])
    # 3D schematic of survey layout
    line1_length = line1.profile_length_m
    line2_length = line2.profile_length_m
    ax.plot([0, line1_length], [0, 0], 'r-', linewidth=3, label='Line 1')
    ax.plot([0, line2_length], [1, 1], 'b-', linewidth=3, label='Line 2')
    ax.fill_between([0, line1_length], -0.2, 0.2, alpha=0.2, color='red')
    ax.fill_between([0, line2_length], 0.8, 1.2, alpha=0.2, color='blue')
    ax.set_xlabel('Easting (m)')
    ax.set_ylabel('Northing (m)')
    ax.set_title('Survey Layout')
    ax.legend()
    ax.set_aspect('equal')
    ax.grid(True, alpha=0.3)

    # Row 5: Interpreted model
    ax = fig.add_subplot(gs[4, :])
    # Create structural interpretation
    data = line1.processed if line1.processed is not None else line1.raw
    vmax = np.percentile(np.abs(data), 98)

    # Overlay on processed data with interpretation
    ax.imshow(data.T, aspect='auto', cmap=gpr_cmap, vmin=-vmax, vmax=vmax,
              extent=[0, line1.profile_length_m, line1.depth_range_m, 0])

    # Identify major reflectors from amplitude envelope
    env_data = np.abs(signal.hilbert(data, axis=1))
    # Find peaks in average envelope to identify layers
    avg_env_profile = env_data.mean(axis=0)
    peaks, properties = signal.find_peaks(avg_env_profile,
                                          height=np.percentile(avg_env_profile, 80),
                                          distance=20)
    peak_depths = line1.depth_axis[peaks]

    for depth in peak_depths:
        if depth > 0.5:  # Skip surface
            ax.axhline(y=depth, color='cyan', linewidth=0.8, linestyle='--', alpha=0.7)
            ax.text(line1.profile_length_m * 0.01, depth, f'{depth:.1f}m',
                    color='white', fontsize=7, va='center',
                    bbox=dict(boxstyle='round,pad=0.2', facecolor='black', alpha=0.6))

    ax.set_title('Line 1 - Interpreted Structural Model with Major Reflectors')
    ax.set_xlabel('Distance (m)')
    ax.set_ylabel('Depth (m)')

    plt.savefig(output_dir / 'comprehensive_report.png', dpi=150, bbox_inches='tight',
                facecolor='white')
    plt.close()
    print(f'Saved: comprehensive_report.png')


def export_model_json(lines, output_dir):
    """Export processed data as JSON for web visualization."""
    export = {
        'survey_info': {
            'system': 'GSSI SIR-4000',
            'antenna_model': 34,
            'dielectric': DIELECTRIC,
            'velocity_m_ns': round(VELOCITY, 4),
            'transmit_rate_khz': 100,
            'scans_per_meter': SCANS_PER_METER,
            'scan_spacing_m': SCAN_SPACING,
            'depth_range_m': lines[0].depth_range_m,
        },
        'lines': []
    }

    for line in lines:
        data = line.processed if line.processed is not None else line.raw
        # Downsample for JSON (every 4th scan, every 2nd depth sample)
        ds = data[::4, ::2]
        export['lines'].append({
            'name': line.name,
            'n_scans': line.n_scans,
            'n_samples': line.n_samples,
            'profile_length_m': line.profile_length_m,
            'depth_axis': line.depth_axis[::2].tolist(),
            'distance_axis': line.distance_axis[::4].tolist(),
            'data_mean': float(ds.mean()),
            'data_std': float(ds.std()),
            'data_shape': list(ds.shape),
            # Store as base64 or summary statistics
            'amplitude_envelope_mean': ds.mean(axis=1).tolist(),
            'amplitude_vs_depth': ds.mean(axis=0).tolist(),
        })

    json_path = output_dir / 'gpr_model.json'
    json_path.write_text(json.dumps(export, indent=2, ensure_ascii=False))
    print(f'Saved: gpr_model.json')


# ============================================================
# MAIN
# ============================================================
def main():
    data_dir = Path('D:/project/public/data/GPR_new/1')
    output_dir = Path('D:/project/public/data/GPR_new/output')
    output_dir.mkdir(exist_ok=True)

    print('=' * 60)
    print('GPR Data Processing & Modeling Pipeline')
    print('=' * 60)

    # 1. Load data
    print('\n[1/5] Loading DZT files...')
    raw1 = read_dzt(data_dir / '0118YLYX__001.DZT')
    raw2 = read_dzt(data_dir / '0118YLYX__002.DZT')
    line1 = GPRData('Line 1', raw1)
    line2 = GPRData('Line 2', raw2)

    print(f'  Line 1: {line1.n_scans} scans × {line1.n_samples} samples, '
          f'{line1.profile_length_m:.1f}m profile, {line1.twt_ns:.0f}ns TWT')
    print(f'  Line 2: {line2.n_scans} scans × {line2.n_samples} samples, '
          f'{line2.profile_length_m:.1f}m profile, {line2.twt_ns:.0f}ns TWT')
    print(f'  Velocity: {VELOCITY:.4f} m/ns (εr={DIELECTRIC})')
    print(f'  Depth resolution: {line1.depth_axis[1]:.3f} m/sample')
    print(f'  Scan spacing: {SCAN_SPACING:.3f} m')

    # 2. Process data
    print('\n[2/5] Processing pipeline (dewow → background removal → bandpass → AGC)...')
    line1.process_pipeline()
    line2.process_pipeline()
    print('  Done.')

    # 3. Generate individual visualizations
    print('\n[3/5] Generating individual radargrams...')
    for line in [line1, line2]:
        fig, axes = plt.subplots(1, 2, figsize=(18, 6))
        line.plot_radargram(data=line.raw, title=f'{line.name} - Raw',
                            ax=axes[0], clip_percentile=98)
        line.plot_radargram(data=line.processed, title=f'{line.name} - Processed',
                            ax=axes[1], clip_percentile=98)
        fig.tight_layout()
        fig.savefig(output_dir / f'{line.name.lower().replace(" ", "_")}_comparison.png',
                    dpi=150, bbox_inches='tight', facecolor='white')
        plt.close()
        print(f'  Saved: {line.name.lower().replace(" ", "_")}_comparison.png')

    # 4. Wiggle plots
    print('\n  Generating wiggle trace plots...')
    for line, step in [(line1, 3), (line2, 3)]:
        fig, ax = plt.subplots(figsize=(16, 7))
        line.plot_wiggle(trace_spacing=step, ax=ax, scale=0.8)
        fig.savefig(output_dir / f'{line.name.lower().replace(" ", "_")}_wiggle.png',
                    dpi=150, bbox_inches='tight', facecolor='white')
        plt.close()

    # 5. Comprehensive report
    print('\n[4/5] Generating comprehensive analysis report...')
    plot_comprehensive_report(line1, line2, output_dir)

    # 6. Export model
    print('\n[5/5] Exporting model data...')
    export_model_json([line1, line2], output_dir)

    # Summary
    print('\n' + '=' * 60)
    print('Processing complete! Output files:')
    for f in sorted(output_dir.glob('*')):
        print(f'  {f.name} ({f.stat().st_size / 1024:.1f} KB)')
    print('=' * 60)

    # Interpretation summary
    print('\n--- Structural Interpretation ---')
    for line in [line1, line2]:
        data = line.processed
        env = np.abs(signal.hilbert(data, axis=1))
        avg_env = env.mean(axis=0)
        peaks, props = signal.find_peaks(avg_env,
                                         height=np.percentile(avg_env, 80),
                                         distance=20)
        peak_depths = line.depth_axis[peaks]
        peak_amps = props['peak_heights']
        print(f'\n{line.name} major reflectors at depths:')
        for d, a in zip(peak_depths, peak_amps):
            if d > 0.5:
                print(f'  {d:.2f} m (relative amplitude: {a/np.max(avg_env):.3f})')


if __name__ == '__main__':
    main()
