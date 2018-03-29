import React from "react";
import ReactNative, {
  Text,
  View,
  StyleSheet,
  Modal,
  TouchableHighlight,
  TextInput,
  Image,
  Button,
  Linking
} from "react-native";
import { IS_NATIVE, IS_ANDROID } from "./polyfill";
import styled from "./styled";
import Form from "./form";
import Logout from "./logout";
import { login, checkLogin } from "./auth/auth";
import SP from "sp-client";

const Overall = styled.View`
  align-items: center;
  justify-content: flex-start;
  flex-grow: 1;
  padding: 15px;
  ${!IS_NATIVE && "-webkit-app-region: drag"};
`;

const RestCentered = styled(Form)`
  align-items: stretch;
  max-width: 550px;
  justify-content: flex-start;
  flex-grow: 1;
  width: 100%;
`;

const UserName = styled.TextInput`
  border-bottom-color: black;
  border-bottom-width: ${IS_ANDROID ? "0px" : "1px"};
  border-style: solid;
  height: 80px;
  font-size: 30px;
  width: 100%;
  margin-bottom: 10px;
  padding-left: 5px;
  padding-right: 5px;
`;

const LogoImage = styled.Image`
  height: 100px;
  width: 100%;
  ${IS_NATIVE && "margin-top: 50px"};
`;

const LoginButton = styled.Button`
  height: 80px;
`;

let logoSource = require("./streamplace-logo.svg");
if (IS_NATIVE) {
  logoSource = require("./streamplace-logo.png");
}

export default class Login extends React.Component {
  constructor() {
    super();
    this.state = {
      email: "",
      password: "",
      loading: true,
      loggedIn: false
    };
  }
  componentWillMount() {
    checkLogin()
      .then(user => {
        if (user) {
          return this.setState({
            loading: false,
            loggedIn: true
          });
        }
        return this.setState({
          loading: false,
          loggedIn: false
        });
      })
      .catch(err => {
        this.setState({ loading: false, loggedIn: false });
      });
  }
  login() {
    login({
      email: this.state.email,
      password: this.state.password
    });
  }
  render() {
    if (this.state.loading) {
      return <View />;
    }
    if (this.state.loggedIn) {
      return (
        <Overall>
          <RestCentered>
            <Logout />
          </RestCentered>
        </Overall>
      );
    }
    return (
      <Overall>
        <RestCentered>
          <LogoImage resizeMode={"contain"} source={logoSource} />
          <UserName
            onChangeText={email =>
              this.setState({
                email
              })
            }
            editable={true}
            value={this.state.email}
            placeholder="email"
            keyboardType="email-address"
            onSubmitEditing={() => {
              if (IS_NATIVE) {
                this.passwordInput.focus();
              } else {
                this.login();
              }
            }}
            returnKeyType="next"
          />
          <UserName
            onChangeText={password =>
              this.setState({
                password
              })
            }
            editable={true}
            secureTextEntry={true}
            onSubmitEditing={() => this.login()}
            value={this.state.password}
            placeholder="password"
            returnKeyType="go"
            innerRef={ref => (this.passwordInput = ref)}
          />
          <LoginButton title="Log In" onPress={() => this.login()} />
        </RestCentered>
      </Overall>
    );
  }
}
