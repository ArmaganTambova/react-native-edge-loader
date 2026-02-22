import { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Platform,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { getCutouts, EdgeLoaderView, type Cutout } from 'react-native-edge-loader';

export default function App() {
  const [result, setResult] = useState<Cutout | null>(null);
  const [status, setStatus] = useState<string>('Hazır');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [beamColor, setBeamColor] = useState<string>('#00FFFF');

  const checkCutout = () => {
    setStatus('Kontrol ediliyor...');
    getCutouts()
      .then((data) => {
        console.log('Gelen Veri:', data);
        setResult(data);
        setStatus('Tamamlandı');
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Bilinmeyen hata';
        console.error(err);
        setStatus('Hata: ' + msg);
      });
  };

  useEffect(() => {
    checkCutout();
    const timer = setTimeout(checkCutout, 1000);
    return () => clearTimeout(timer);
  }, []);

  const colors = ['#00FFFF', '#FF00FF', '#FFD700', '#00FF88', '#FF6B35'];

  return (
    <View style={styles.safe}>
      {/* The beam animates around the cutout, floating above everything */}
      <EdgeLoaderView
        isLoading={isLoading}
        color={beamColor}
        strokeWidth={3}
        beamLength={0.25}
        duration={1800}
        glowRadius={6}
        glowOpacity={0.85}
        padding={4}
        onDetected={(c) => console.log('Detected:', c)}
      />

      <View style={styles.container}>
        <Text style={styles.header}>Edge Loader</Text>
        <Text style={styles.subtitle}>Cutout Loading Animation</Text>

        {/* Loading toggle */}
        <View style={styles.card}>
          <Text style={styles.label}>Loading Animasyonu</Text>
          <View style={styles.row}>
            <Text style={styles.toggleLabel}>
              {isLoading ? 'AÇIK' : 'KAPALI'}
            </Text>
            <Switch
              value={isLoading}
              onValueChange={setIsLoading}
              trackColor={{ false: '#555', true: '#00AACC' }}
              thumbColor={isLoading ? '#00FFFF' : '#999'}
            />
          </View>
        </View>

        {/* Color picker */}
        <View style={styles.card}>
          <Text style={styles.label}>Işık Rengi</Text>
          <View style={styles.colorRow}>
            {colors.map((c) => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.colorDot,
                  { backgroundColor: c },
                  beamColor === c && styles.colorDotSelected,
                ]}
                onPress={() => setBeamColor(c)}
              />
            ))}
          </View>
        </View>

        {/* Cutout info */}
        <View style={styles.card}>
          <Text style={styles.label}>Tespit Edilen Cutout</Text>
          <Text style={styles.statusText}>{status}</Text>
          <Text style={styles.json}>{JSON.stringify(result, null, 2)}</Text>
        </View>

        <TouchableOpacity style={styles.button} onPress={checkCutout}>
          <Text style={styles.buttonText}>YENİDEN TARA</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>
          {Platform.OS === 'android' ? 'Android' : 'iOS'} —{' '}
          {result?.type ?? 'bilinmiyor'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 24,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    padding: 16,
    borderRadius: 12,
    width: '100%',
    marginBottom: 12,
  },
  label: {
    fontWeight: '600',
    marginBottom: 10,
    color: '#888',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statusText: {
    fontSize: 14,
    color: '#00FFAA',
    marginBottom: 6,
  },
  json: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    color: '#00CCFF',
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 12,
  },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  colorDotSelected: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  button: {
    backgroundColor: '#1E3A4A',
    borderWidth: 1,
    borderColor: '#00AACC',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginTop: 4,
  },
  buttonText: {
    color: '#00FFFF',
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 2,
  },
  footer: {
    marginTop: 20,
    color: '#444',
    fontSize: 12,
    letterSpacing: 1,
  },
});
