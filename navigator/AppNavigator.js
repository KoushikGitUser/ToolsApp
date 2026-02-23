import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Home from '../Screens/Home';
import FullBlur from '../Screens/FullBlur';
import SpotBlur from '../Screens/SpotBlur';
import ImageToPdf from '../Screens/ImageToPdf';
import ImageCompressor from '../Screens/ImageCompressor';
import ImageFormatConverter from '../Screens/ImageFormatConverter';
import VideoCompressor from '../Screens/VideoCompressor';
import AudioCompressor from '../Screens/AudioCompressor';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Home" component={Home} />
      <Stack.Screen name="FullBlur" component={FullBlur} />
      <Stack.Screen name="SpotBlur" component={SpotBlur} />
      <Stack.Screen name="ImageToPdf" component={ImageToPdf} />
      <Stack.Screen name="ImageCompressor" component={ImageCompressor} />
      <Stack.Screen name="VideoCompressor" component={VideoCompressor} />
      <Stack.Screen name="AudioCompressor" component={AudioCompressor} />
      <Stack.Screen name="ImageFormatConverter" component={ImageFormatConverter} />
    </Stack.Navigator>
  );
};

export default AppNavigator;
