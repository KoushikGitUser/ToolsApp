import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './navigator/AppNavigator';
import Toaster from './Components/UniversalToaster/Toaster';

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <AppNavigator />
      <Toaster />
    </NavigationContainer>
  );
}
