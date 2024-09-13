"use script";

const SIGNAL_TYPE_JOIN = "join";
const SIGNAL_TYPE_RESP_JOIN = "resp-join";
const SIGNAL_TYPE_NEW_PEER = "new-peer";
const SIGNAL_TYPE_PEER_LEAVE = "peer-leave";
const SIGNAL_TYPE_OFFER = "offer";
const SIGNAL_TYPE_ANSWER = "answer";
const SIGNAL_TYPE_CANDIDATE = "candidate";

var localVideo = document.querySelector("#localVideo");
var remoteVideo = document.querySelector("#remoteVideo");
var localUserId = Math.random().toString(36).substr(2);
var remoteUserId = 0;
var localStream = null;
var remoteStream = null;
var roomId = 0;
var pc = null;

//创建RTCPeerConnection

function handleIceCandidate(event) {
  console.log("handleIceCandidate");
  if (event.candidate) {
    let jsonMsg = {
      cmd: "candidate",
      roomId: roomId,
      uid: localUserId,
      remoteUid: remoteUserId,
      msg: JSON.stringify(event.candidate),
    };
    var msg = JSON.stringify(jsonMsg);
    rtcEngine.sendMessage(msg);
    console.log("handleIceCandidate message: " + msg);
  } else {
    console.log("End of handleIceCandidate");
  }
}

function handleRemoteStreamAdd(event) {
  console.log("handleRemoteStreamAdd");
  remoteStream = event.streams[0];
  remoteVideo.srcObject = remoteStream;
}

function handleConnectionStateChange() {
  if (pc != null) {
    console.info("ConnectionState -> " + pc.connectionState);
  }
}

function handleIceConnectionStateChange() {
  if (pc != null) {
    console.info("IceConnectionState -> " + pc.iceConnectionState);
  }
}

function createPeerConnection() {
  var defaultConfiguration = {
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require",
    iceTransportPolicy: "all", //relay 或者 all
    // 修改ice数组测试效果，需要进行封装
    iceServers: [
      {
        urls: [
          "turn:192.168.2.101:3478?transport=udp",
          "turn:192.168.2.101:3478?transport=tcp", // 可以插入多个进行备选
        ],
        username: "demo",
        credential: "666",
      },
      {
        urls: ["stun:192.168.2.101:3478"],
      },
    ],
  };
  pc = new RTCPeerConnection(defaultConfiguration);
  pc.onicecandidate = handleIceCandidate;
  pc.ontrack = handleRemoteStreamAdd;
  pc.onconnectionstatechange = handleConnectionStateChange;
  pc.oniceconnectionstatechange = handleIceConnectionStateChange;

  localStream.getTracks().forEach(function (track) {
    pc.addTrack(track, localStream);
  });
}

//处理 offer
function createOfferAndSendMessage(session) {
  pc.setLocalDescription(session)
    .then(function () {
      var jsonMsg = {
        cmd: "offer",
        roomId: roomId,
        uid: localUserId,
        remoteUid: remoteUserId,
        msg: JSON.stringify(session),
      };
      var msg = JSON.stringify(jsonMsg);
      rtcEngine.sendMessage(msg);
      console.log("offer sdp message");
    })
    .catch(function (error) {
      console.error("offer sdp message error :" + error);
    });
}

function handleCreateOfferError() {
  console.error("handleCreateOfferError :" + error);
}

//answer offer
function createAnswerAndSendMessage(session) {
  pc.setLocalDescription(session)
    .then(function () {
      var jsonMsg = {
        cmd: "answer",
        roomId: roomId,
        uid: localUserId,
        remoteUid: remoteUserId,
        msg: JSON.stringify(session),
      };
      var msg = JSON.stringify(jsonMsg);
      rtcEngine.sendMessage(msg);
      console.log("send answer message: " + msg);
    })
    .catch(function (error) {
      console.error("send answer message error :" + error);
    });
}

function handleCreateAnswerError() {
  console.error("handleCreateAnswerError :" + error);
}

//收到信令New Peer
function handleRemoteNewPeer(msg) {
  console.log("handleRemoteNewPeer, remoteUid: " + msg.remoteUid);
  remoteUserId = msg.remoteUid;
  doOffer();
}

//收到信令Resp Join
function handleRemoteResponseJoin(msg) {
  remoteUserId = msg.remoteUid;
  console.log("handleRemoteResponseJoin, remoteUid: " + msg.remoteUid);
}

//收到信令Peer Leave
function handleRemotePeerLeave(msg) {
  console.log("handleRemotePeerLeave, remoteUid: " + msg.remoteUid);
  remoteVideo.srcObject = null;
  if (pc != null) {
    pc.close();
    pc = null;
  }
}

//Offer
function handleRemoteOffer(msg) {
  console.log("handleRemoteOffer");
  if (pc == null) {
    createPeerConnection();
  }
  var desc = JSON.parse(msg.msg);
  pc.setRemoteDescription(desc);
  doAnswer();
}

function handleRemoteAnswer(msg) {
  console.log("handleRemoteAnswer");
  var desc = JSON.parse(msg.msg);
  pc.setRemoteDescription(desc);
}

function handleRemoteCandidate(msg) {
  console.log("handleRemoteCandidate");
  var candidate = JSON.parse(msg.msg);
  pc.addIceCandidate(candidate).catch(function (e) {
    console.error("handleRemoteCandidate error:" + e.name);
  });
}

class RTCEngine {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.signaling = null;
  }

  createWebSocket() {
    this.signaling = new WebSocket(this.wsUrl);

    this.signaling.onopen = this.onOpen;

    this.signaling.onmessage = this.onMessage;

    this.signaling.onerror = this.onError;

    this.signaling.onclose = this.onMessage;
  }

  onOpen() {
    console.log("WebSocket open");
  }

  onMessage(event) {
    console.log("recv msg:" + event.data);

    let jsonMsg = JSON.parse(event.data);
    switch (jsonMsg.cmd) {
      case SIGNAL_TYPE_NEW_PEER:
        handleRemoteNewPeer(jsonMsg);
        break;
      case SIGNAL_TYPE_RESP_JOIN:
        handleRemoteResponseJoin(jsonMsg);
        break;
      case SIGNAL_TYPE_PEER_LEAVE:
        handleRemotePeerLeave(jsonMsg);
        break;
      case SIGNAL_TYPE_OFFER:
        handleRemoteOffer(jsonMsg);
        break;
      case SIGNAL_TYPE_ANSWER:
        handleRemoteAnswer(jsonMsg);
        break;
      case SIGNAL_TYPE_CANDIDATE:
        handleRemoteCandidate(jsonMsg);
        break;
    }
  }

  onError(event) {
    console.log("onMessage:" + event.data);
  }

  onClose(event) {
    console.log(
      "onClose code:" + event.data + ", reason:" + EventTarget.reason
    );
  }

  sendMessage(msg) {
    this.signaling.send(msg);
  }
}

//连接信令服务
var rtcEngine = new RTCEngine("wss://192.168.2.101:8011/ws");
rtcEngine.createWebSocket();

//加入
function doJoin(roomId) {
  var jsonMsg = {
    cmd: "join",
    roomId: roomId,
    uid: localUserId,
  };
  var message = JSON.stringify(jsonMsg);
  rtcEngine.sendMessage(message);
  console.info("doJoin message: " + message);
}

//离开
function doLeave() {
  var jsonMsg = {
    cmd: "leave",
    roomId: roomId,
    uid: localUserId,
  };
  var message = JSON.stringify(jsonMsg);
  rtcEngine.sendMessage(message);
  console.info("doLeave message: " + message);
  remoteVideo.srcObject = null;
  if (localStream != null) {
    localStream.getTracks().forEach(function (track) {
      track.stop();
    });
  }
  localVideo.srcObject = null;

  if (pc != null) {
    pc.close();
    pc = null;
  }
}

//发送offer
function doOffer() {
  if (pc == null) {
    createPeerConnection();
  }
  //create offer
  pc.createOffer()
    .then(createOfferAndSendMessage)
    .catch(handleCreateOfferError);
}

//发送Answer
function doAnswer() {
  //create offer
  pc.createAnswer()
    .then(createAnswerAndSendMessage)
    .catch(handleCreateAnswerError);
}

function openLocalStream(stream) {
  console.log("openLocalStream");
  doJoin(roomId);
  localVideo.srcObject = stream;
  localStream = stream;
}

function openLocalStreamError(e) {
  alert("openLocalStreamError error:" + e);
}

function initLocalStream() {
  navigator.mediaDevices
    .getUserMedia({
      audio: true,
      video: true,
    })
    .then(openLocalStream)
    .catch(openLocalStreamError);
}

//点击加入按钮
document.getElementById("joinBtn").onclick = function () {
  //获取rood id
  roomId = document.getElementById("roomId").value;
  if (roomId == "" || roomId == "请输入房间ID") {
    alert("请输入房间ID!");
    return;
  }

  console.log("加入按钮被点击, 进入房间ID:" + roomId);
  //初始化本地流
  initLocalStream();
};

//点击离开按钮
document.getElementById("leaveBtn").onclick = function () {
  console.log("离开按钮被点击");
  doLeave();
};
