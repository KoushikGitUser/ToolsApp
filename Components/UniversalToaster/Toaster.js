import {
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  PanResponder,
} from "react-native";
import { useEffect, useRef, useState } from "react";
import { toastEmitter } from "../../Services/toast";
import {
  BadgeCheck,
  CircleCheck,
  CircleX,
  Info,
  TriangleAlert,
} from "lucide-react-native";

const Toaster = () => {
  const [toast, setToast] = useState({
    visible: false,
    title: "",
    description: "",
    type: "success",
    duration: 3000,
  });

  const slideAnim = useRef(new Animated.Value(-170)).current;
  const hideTimer = useRef(null);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => {
        return Math.abs(gesture.dy) > 5;
      },

      onPanResponderMove: (_, gesture) => {
        if (gesture.dy < 0) {
          slideAnim.setValue(55 + gesture.dy);
        }
      },

      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy < -40) {
          Animated.timing(slideAnim, {
            toValue: -170,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            setToast((t) => ({ ...t, visible: false }));
          });
        } else {
          Animated.spring(slideAnim, {
            toValue: 55,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    const listener = (data) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);

      const duration = data.duration || 3000;

      setToast({
        visible: true,
        title: data.title || "",
        description: data.description || "",
        type: data.type || "success",
        duration,
      });

      slideAnim.setValue(-170);

      Animated.timing(slideAnim, {
        toValue: 55,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        hideTimer.current = setTimeout(() => {
          Animated.timing(slideAnim, {
            toValue: -170,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            setToast((t) => ({ ...t, visible: false }));
          });
        }, duration);
      });
    };

    const off = toastEmitter.on("SHOW_TOAST", listener);
    return () => off();
  }, []);

  if (!toast.visible) return null;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[styles.toast, { transform: [{ translateY: slideAnim }] }]}
    >
      {toast.type === "success" ? (
        <BadgeCheck style={{ marginTop: 5 }} color="#03B32F" strokeWidth={1.25} />
      ) : toast.type === "alert" ? (
        <TriangleAlert style={{ marginTop: 5 }} color="#FFA412" strokeWidth={1.25} />
      ) : toast.type === "info" ? (
        <Info style={{ marginTop: 5 }} color="#4A90D9" strokeWidth={1.25} />
      ) : toast.type === "normal" ? (
        <CircleCheck style={{ marginTop: 5 }} color="#888888" strokeWidth={1.25} />
      ) : (
        <CircleX style={{ marginTop: 5 }} color="#D00B0B" strokeWidth={1.25} />
      )}

      <Animated.View style={styles.textContainer}>
        <Text style={styles.textTitle}>{toast.title}</Text>
        {toast.description !== "" && (
          <Text style={styles.textDesc}>{toast.description}</Text>
        )}
      </Animated.View>
    </Animated.View>
  );
};

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  toast: {
    width: width - 40,
    position: "absolute",
    left: 20,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: "#1A1A1A",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#333",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    zIndex: 9999999999,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  textContainer: {
    flex: 1,
    flexShrink: 1,
  },
  textTitle: {
    fontWeight: "700",
    fontSize: 16,
    color: "#fff",
  },
  textDesc: {
    color: "#aaa",
    fontSize: 14,
    marginTop: 2,
  },
});

export default Toaster;
