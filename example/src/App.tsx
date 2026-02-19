import { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { getCutouts, type Cutout } from 'react-native-edge-loader';

export default function App() {
  const [result, setResult] = useState<Cutout | null>(null);
  const [status, setStatus] = useState<string>('Hazır');

  // Bu fonksiyonu hem açılışta hem butona basınca çağıracağız
  const checkCutout = () => {
    setStatus('Kontrol ediliyor...');
    getCutouts()
      .then((data) => {
        console.log('Gelen Veri:', data);
        setResult(data);
        setStatus('Tamamlandı');
      })
      .catch((err: any) => {
        console.error(err);
        setStatus('Hata: ' + (err?.message || 'Bilinmeyen hata'));
      });
  };

  useEffect(() => {
    // Açılışta hemen dene (Bazen kaçırabilir)
    checkCutout();

    // GARANTİ YÖNTEM: 1 saniye sonra tekrar dene
    setTimeout(() => {
      checkCutout();
    }, 1000);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Edge Loader Test</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Durum:</Text>
        <Text style={styles.value}>{status}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Tespit Edilen:</Text>
        <Text style={styles.json}>{JSON.stringify(result, null, 2)}</Text>
      </View>

      {/* MANUEL KONTROL BUTONU */}
      <TouchableOpacity style={styles.button} onPress={checkCutout}>
        <Text style={styles.buttonText}>TEKRAR DENE (YENİLE)</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>
        {Platform.OS === 'android'
          ? 'Android Native Module'
          : 'iOS Native Module'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f2f2f2',
    padding: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  card: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: '100%',
    marginBottom: 15,
    elevation: 3,
  },
  label: { fontWeight: 'bold', marginBottom: 5, color: '#555' },
  value: { fontSize: 16, color: 'green' },
  json: { fontFamily: 'monospace', fontSize: 14, color: '#d63384' },
  footer: { marginTop: 20, color: '#999' },
  // Buton stili
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginTop: 10,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
